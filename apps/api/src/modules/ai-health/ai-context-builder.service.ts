import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { HealthTrendsService } from '../health-trends/health-trends.service';
import { TrendContext, ResultExplanationContext, GeneralInfoContext } from './prompts';
import { GetTrendsDto } from '../health-trends/dto';

@Injectable()
export class AIContextBuilder {
  constructor(
    private readonly db: PrismaService,
    private readonly healthTrends: HealthTrendsService,
  ) {}

  async buildTrendContext(userId: string, parameterCode: string, dateRange?: { from?: string; to?: string }): Promise<TrendContext | null> {
    const dto: GetTrendsDto & { parameter: string } = {
      parameter: parameterCode,
      ...(dateRange?.from && { from: dateRange.from }),
      ...(dateRange?.to && { to: dateRange.to }),
    };

    const trendData = await this.healthTrends.getTrendData(userId, dto);

    if (!trendData || trendData.points.length === 0) {
      return null;
    }

    return {
      parameterCode: trendData.parameterCode,
      parameterName: trendData.parameterName,
      unit: trendData.unit,
      latestValue: trendData.latestValue,
      latestDate: trendData.latestValueDate || new Date().toISOString(),
      previousValue: trendData.previousValue,
      previousDate: trendData.previousValueDate,
      absoluteChange: trendData.absoluteChange,
      percentageChange: trendData.percentageChange,
      trend: trendData.trend,
      referenceMin: trendData.referenceMin,
      referenceMax: trendData.referenceMax,
      laboratoryName: trendData.latestValueLaboratory,
      dataPoints: trendData.points.map((p) => ({
        date: p.date,
        value: p.value,
        unit: p.unit,
      })),
    };
  }

  async buildResultExplanationContext(userId: string, resultId: string): Promise<ResultExplanationContext | null> {
    const result = await this.db.laboratoryResult.findFirst({
      where: {
        id: resultId,
        donorId: userId,
        status: 'PUBLISHED',
      },
      include: {
        items: {
          include: {
            parameter: {
              include: {
                testType: true,
              },
            },
          },
        },
        laboratory: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    const previousResults = await this.db.laboratoryResult.findMany({
      where: {
        donorId: userId,
        status: 'PUBLISHED',
        id: { not: resultId },
      },
      include: {
        items: {
          include: {
            parameter: true,
          },
        },
      },
      orderBy: {
        performedAt: 'desc',
      },
      take: 5,
    });

    const contextItems: ResultExplanationContext[] = [];

    for (const item of result.items) {
      if (item.parameter.dataType !== 'numeric' || item.numericValue === null) {
        continue;
      }

      const previousValues = previousResults
        .flatMap((r) => r.items)
        .filter((i) => i.parameter.code === item.parameter.code && i.numericValue !== null)
        .map((i) => ({
          date: result.performedAt?.toISOString() || '',
          value: Number(i.numericValue!),
        }));

      // This parameter's own range ahead of the test type's shared one; see
      // HealthTrendsService.getReferenceRangeForParameter for why.
      const refRange = await this.db.testReferenceRange.findFirst({
        where: {
          testTypeId: item.parameter.testTypeId,
          OR: [{ parameterId: item.parameterId }, { parameterId: null }],
          isActive: true,
        },
        orderBy: [{ parameterId: 'desc' }],
      });

      contextItems.push({
        resultId: result.id,
        parameterCode: item.parameter.code,
        parameterName: item.parameter.name,
        value: Number(item.numericValue!),
        unit: item.unit || item.parameter.unit || undefined,
        date: result.performedAt?.toISOString() || '',
        referenceMin: refRange?.minValue ? Number(refRange.minValue) : undefined,
        referenceMax: refRange?.maxValue ? Number(refRange.maxValue) : undefined,
        laboratoryName: result.laboratory?.name,
        testTypeName: item.parameter.testType.name,
        previousValues,
      });
    }

    return contextItems[0] || null;
  }

  async buildGeneralInfoContext(parameterCode: string): Promise<GeneralInfoContext | null> {
    const param = await this.db.testParameter.findFirst({
      where: {
        code: parameterCode,
      },
      include: {
        testType: true,
      },
    });

    if (!param) {
      return null;
    }

    return {
      parameterCode: param.code,
      parameterName: param.name,
      unit: param.unit || undefined,
      category: param.testType.category,
    };
  }

  async getUserHealthSummary(userId: string): Promise<string> {
    const summary = await this.healthTrends.getSummary(userId, {});

    if (summary.totalTests === 0) {
      return 'No laboratory test data available for this user.';
    }

    let context = `User Health Summary:
- Total blood tests: ${summary.totalTests}
- Parameters tracked: ${summary.totalParameters || 0}
- Last test: ${summary.lastTestDate ? new Date(summary.lastTestDate).toLocaleDateString() : 'Unknown'}`;

    if (summary.availableParameters.length > 0) {
      context += '\n\nParameters with data:';
      for (const param of summary.availableParameters.slice(0, 10)) {
        context += `\n- ${param.name}: ${param.latestValue !== undefined ? `${param.latestValue} ${param.unit || ''}` : 'No recent value'}`;
      }
    }

    return context;
  }
}
