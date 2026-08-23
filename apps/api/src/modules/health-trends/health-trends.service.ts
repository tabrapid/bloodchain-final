import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GetTrendsDto, GetTrendSummaryDto } from './dto';
import {
  TrendDataDto,
  TrendPointDto,
  TrendSummaryDto,
  ParameterStatisticsDto,
  TrendHistoryResponseDto,
  TrendHistoryItemDto,
  AvailableParameterDto,
} from './dto/trend-response.dto';

@Injectable()
export class HealthTrendsService {
  constructor(private readonly db: PrismaService) {}

  async getAvailableParameters(userId: string): Promise<AvailableParameterDto[]> {
    const results = await this.db.laboratoryResult.findMany({
      where: {
        donorId: userId,
        status: 'PUBLISHED',
      },
      select: {
        items: {
          select: {
            parameter: {
              select: {
                code: true,
                name: true,
                unit: true,
                dataType: true,
                testType: {
                  select: {
                    category: true,
                  },
                },
              },
            },
            numericValue: true,
          },
        },
        performedAt: true,
        laboratoryId: true,
        laboratory: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        performedAt: 'desc',
      },
    });

    const parameterMap = new Map<string, AvailableParameterDto>();

    for (const result of results) {
      for (const item of result.items) {
        if (item.parameter.dataType !== 'numeric' || item.numericValue === null) {
          continue;
        }

        const existing = parameterMap.get(item.parameter.code);
        const itemDate = result.performedAt?.toISOString() || '';

        if (!existing) {
          parameterMap.set(item.parameter.code, {
            code: item.parameter.code,
            name: item.parameter.name,
            unit: item.parameter.unit || undefined,
            category: item.parameter.testType.category,
            measurementCount: 1,
            latestValue: Number(item.numericValue),
            latestValueDate: itemDate,
            hasReferenceRange: false,
          });
        } else {
          existing.measurementCount += 1;
          if (itemDate > (existing.latestValueDate || '')) {
            existing.latestValue = Number(item.numericValue);
            existing.latestValueDate = itemDate;
          }
        }
      }
    }

    const parameterCodes = Array.from(parameterMap.keys());
    if (parameterCodes.length === 0) {
      return [];
    }

    const referenceRanges = await this.db.testReferenceRange.findMany({
      where: {
        testType: {
          parameters: {
            some: {
              code: {
                in: parameterCodes,
              },
            },
          },
        },
        isActive: true,
      },
      select: {
        testType: {
          select: {
            parameters: {
              where: {
                code: {
                  in: parameterCodes,
                },
              },
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    const testTypeCodesWithRanges = new Set<string>();
    for (const range of referenceRanges) {
      for (const param of range.testType.parameters) {
        testTypeCodesWithRanges.add(param.code);
      }
    }

    for (const param of parameterMap.values()) {
      if (testTypeCodesWithRanges.has(param.code)) {
        param.hasReferenceRange = true;
      }
    }

    return Array.from(parameterMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTrendData(userId: string, dto: GetTrendsDto): Promise<TrendDataDto | null> {
    if (!dto.parameter) {
      return null;
    }

    const dateRange = this.parseDateRange(dto.range, dto.from, dto.to);

    const where: Prisma.LaboratoryResultItemWhereInput = {
      result: {
        donorId: userId,
        status: 'PUBLISHED',
      },
      parameter: {
        code: dto.parameter,
        dataType: 'numeric',
      },
    };

    if (dateRange) {
      where.result = {
        ...where.result,
        performedAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      } as Prisma.LaboratoryResultWhereInput;
    }

    const items = await this.db.laboratoryResultItem.findMany({
      where,
      select: {
        numericValue: true,
        unit: true,
        flag: true,
        parameter: {
          select: {
            code: true,
            name: true,
            unit: true,
            testType: {
              select: {
                category: true,
              },
            },
          },
        },
        result: {
          select: {
            id: true,
            performedAt: true,
            laboratoryId: true,
            laboratory: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        result: {
          performedAt: 'asc',
        },
      },
    });

    if (items.length === 0) {
      return null;
    }

    const validItems = items.filter((item) => item.numericValue !== null);
    if (validItems.length === 0) {
      return null;
    }

    const points: TrendPointDto[] = validItems.map((item) => ({
      date: item.result.performedAt?.toISOString() || '',
      value: Number(item.numericValue!),
      unit: item.unit || item.parameter.unit || undefined,
      laboratoryId: item.result.laboratoryId,
      laboratoryName: item.result.laboratory?.name,
      resultId: item.result.id,
      flag: item.flag,
    }));

    const latest = validItems[validItems.length - 1]!;
    const previous = validItems.length > 1 ? validItems[validItems.length - 2] : null;

    let absoluteChange: number | undefined;
    let percentageChange: number | undefined;
    let trend: 'INCREASING' | 'DECREASING' | 'STABLE' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';

    if (previous && previous.numericValue !== null) {
      const prevNum = Number(previous.numericValue);
      const latestNum = Number(latest.numericValue);
      if (prevNum !== 0) {
        absoluteChange = latestNum - prevNum;
        percentageChange = (absoluteChange / prevNum) * 100;

        const threshold = Math.abs(prevNum * 0.02);
        if (absoluteChange > threshold) {
          trend = 'INCREASING';
        } else if (absoluteChange < -threshold) {
          trend = 'DECREASING';
        } else {
          trend = 'STABLE';
        }
      }
    } else if (validItems.length >= 2) {
      const first = Number(validItems[0]!.numericValue!);
      const last = Number(latest.numericValue!);
      absoluteChange = last - first;
      if (Math.abs(absoluteChange) > Math.abs(first * 0.02)) {
        trend = absoluteChange > 0 ? 'INCREASING' : 'DECREASING';
      } else {
        trend = 'STABLE';
      }
    }

    const referenceRange = await this.getReferenceRangeForParameter(dto.parameter);

    return {
      parameterCode: dto.parameter,
      parameterName: latest.parameter.name,
      unit: latest.unit || latest.parameter.unit || undefined,
      category: latest.parameter.testType.category,
      latestValue: Number(latest.numericValue!),
      latestValueDate: latest.result.performedAt?.toISOString(),
      latestValueLaboratory: latest.result.laboratory?.name,
      previousValue: previous ? Number(previous.numericValue!) : undefined,
      previousValueDate: previous?.result.performedAt?.toISOString(),
      absoluteChange,
      percentageChange,
      referenceMin: referenceRange?.minValue ? Number(referenceRange.minValue) : undefined,
      referenceMax: referenceRange?.maxValue ? Number(referenceRange.maxValue) : undefined,
      trend,
      points,
      hasReferenceRange: !!referenceRange,
    };
  }

  async getParameterStatistics(userId: string, parameterCode: string): Promise<ParameterStatisticsDto | null> {
    const items = await this.db.laboratoryResultItem.findMany({
      where: {
        result: {
          donorId: userId,
          status: 'PUBLISHED',
        },
        parameter: {
          code: parameterCode,
          dataType: 'numeric',
        },
      },
      select: {
        numericValue: true,
        unit: true,
        parameter: {
          select: {
            code: true,
            name: true,
            unit: true,
          },
        },
        result: {
          select: {
            performedAt: true,
            laboratory: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        result: {
          performedAt: 'asc',
        },
      },
    });

    const validItems = items.filter((item) => item.numericValue !== null);
    if (validItems.length === 0) {
      return null;
    }

    const firstItem = validItems[0]!;
    const latestItem = validItems[validItems.length - 1]!;

    const values = validItems.map((item) => Number(item.numericValue!));
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const minItem = validItems.find((item) => Number(item.numericValue!) === min);
    const maxItem = validItems.find((item) => Number(item.numericValue!) === max);

    return {
      parameterCode: firstItem.parameter.code,
      parameterName: firstItem.parameter.name,
      unit: firstItem.unit || firstItem.parameter.unit || undefined,
      measurementCount: validItems.length,
      latest: Number(latestItem.numericValue!),
      latestDate: latestItem.result.performedAt?.toISOString(),
      minimum: min,
      minimumDate: minItem?.result.performedAt?.toISOString(),
      maximum: max,
      maximumDate: maxItem?.result.performedAt?.toISOString(),
      average: Math.round(average * 100) / 100,
      firstValue: Number(firstItem.numericValue!),
      firstDate: firstItem.result.performedAt?.toISOString(),
      latestLaboratory: latestItem.result.laboratory?.name,
    };
  }

  async getTrendHistory(
    userId: string,
    parameterCode: string,
    limit = 20,
    offset = 0,
  ): Promise<TrendHistoryResponseDto | null> {
    const where: Prisma.LaboratoryResultItemWhereInput = {
      result: {
        donorId: userId,
        status: 'PUBLISHED',
      },
      parameter: {
        code: parameterCode,
      },
    };

    const [items, total] = await Promise.all([
      this.db.laboratoryResultItem.findMany({
        where,
        select: {
          numericValue: true,
          value: true,
          unit: true,
          flag: true,
          referenceMin: true,
          referenceMax: true,
          parameter: {
            select: {
              code: true,
              name: true,
              unit: true,
            },
          },
          result: {
            select: {
              id: true,
              performedAt: true,
              laboratoryId: true,
              laboratory: {
                select: {
                  name: true,
                },
              },
              testType: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          result: {
            performedAt: 'desc',
          },
        },
        take: limit,
        skip: offset,
      }),
      this.db.laboratoryResultItem.count({ where }),
    ]);

    if (items.length === 0) {
      return null;
    }

    const firstItem = items[0]!;
    const referenceRange = await this.getReferenceRangeForParameter(parameterCode);

    const history: TrendHistoryItemDto[] = items
      .filter((item) => item.numericValue !== null)
      .map((item) => ({
        date: item.result.performedAt?.toISOString() || '',
        value: Number(item.numericValue!),
        unit: item.unit || item.parameter.unit || undefined,
        laboratoryId: item.result.laboratoryId,
        laboratoryName: item.result.laboratory?.name,
        resultId: item.result.id,
        testTypeName: item.result.testType?.name,
        referenceMin: item.referenceMin ? Number(item.referenceMin) : undefined,
        referenceMax: item.referenceMax ? Number(item.referenceMax) : undefined,
        flag: item.flag,
      }));

    return {
      parameterCode: firstItem.parameter.code,
      parameterName: firstItem.parameter.name,
      unit: firstItem.unit || firstItem.parameter.unit || undefined,
      hasReferenceRange: !!referenceRange,
      referenceMin: referenceRange?.minValue ? Number(referenceRange.minValue) : undefined,
      referenceMax: referenceRange?.maxValue ? Number(referenceRange.maxValue) : undefined,
      history,
      total,
    };
  }

  async getSummary(userId: string, dto: GetTrendSummaryDto): Promise<TrendSummaryDto> {
    const dateRange = this.parseDateRange(dto.range);

    const dateFilter: Prisma.LaboratoryResultWhereInput = {};
    if (dateRange) {
      dateFilter.performedAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const [publishedResults, upcomingAppointment, availableParams] = await Promise.all([
      this.db.laboratoryResult.findMany({
        where: {
          donorId: userId,
          status: 'PUBLISHED',
          ...dateFilter,
        },
        select: {
          id: true,
          performedAt: true,
          laboratory: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          performedAt: 'desc',
        },
      }),
      this.db.appointment.findFirst({
        where: {
          donorId: userId,
          appointmentType: 'BLOOD_TEST',
          status: {
            in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'],
          },
          scheduledStart: {
            gte: new Date(),
          },
        },
        select: {
          scheduledStart: true,
        },
        orderBy: {
          scheduledStart: 'asc',
        },
      }),
      this.getAvailableParameters(userId),
    ]);

    const lastResult = publishedResults[0];

    const firstParam = availableParams[0];
    let recentTrend: TrendDataDto | undefined;
    if (firstParam) {
      const trendData = await this.getTrendData(userId, { parameter: firstParam.code });
      if (trendData) {
        recentTrend = trendData;
      }
    }

    return {
      totalTests: publishedResults.length,
      totalParameters: availableParams.length,
      lastTestDate: lastResult?.performedAt?.toISOString(),
      lastTestLaboratory: lastResult?.laboratory?.name,
      nextUpcomingAppointment: upcomingAppointment?.scheduledStart?.toISOString(),
      availableParameters: availableParams.slice(0, 10),
      recentTrend,
    };
  }

  private async getReferenceRangeForParameter(parameterCode: string) {
    const param = await this.db.testParameter.findFirst({
      where: {
        code: parameterCode,
      },
      select: {
        testTypeId: true,
      },
    });

    if (!param) {
      return null;
    }

    return this.db.testReferenceRange.findFirst({
      where: {
        testTypeId: param.testTypeId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private parseDateRange(
    range?: string,
    from?: string,
    to?: string,
  ): { from: Date; to: Date } | null {
    if (from && to) {
      return {
        from: new Date(from),
        to: new Date(to),
      };
    }

    if (range && range !== 'ALL') {
      const now = new Date();
      let from: Date;

      switch (range) {
        case '1M':
          from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3M':
          from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case '6M':
          from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
          break;
        case '1Y':
          from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case '2Y':
          from = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
          break;
        default:
          return null;
      }

      return {
        from,
        to: now,
      };
    }

    return null;
  }
}
