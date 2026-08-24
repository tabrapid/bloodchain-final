import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AISafetyLevel } from '@prisma/client';

export interface CreateConversationDto {
  title?: string;
  contextType?: string;
  contextId?: string;
}

export interface ConversationSummaryDto {
  id: string;
  title: string | null;
  contextType: string | null;
  lastMessageAt: Date | null;
  messageCount: number;
  createdAt: Date;
}

export interface ConversationDetailDto {
  id: string;
  title: string | null;
  contextType: string | null;
  contextId: string | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    safetyLevel: AISafetyLevel | null;
    createdAt: Date;
  }>;
}

export interface SendMessageDto {
  conversationId: string;
  content: string;
  safetyLevel?: AISafetyLevel;
  promptVersion?: string;
  model?: string;
}

const DEFAULT_RETENTION_DAYS = 90;
const MAX_MESSAGES_PER_CONVERSATION = 50;

@Injectable()
export class AIConversationService {
  private readonly logger = new Logger(AIConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createConversation(userId: string, dto: CreateConversationDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_RETENTION_DAYS);

    const conversation = await this.prisma.aIConversation.create({
      data: {
        userId,
        title: dto.title?.slice(0, 200) || null,
        contextType: dto.contextType || null,
        contextId: dto.contextId || null,
        expiresAt,
        messageCount: 0,
      },
    });

    this.logger.log(`Conversation created: ${conversation.id}`);
    return conversation;
  }

  async getUserConversations(userId: string, options: { limit?: number; offset?: number } = {}): Promise<ConversationSummaryDto[]> {
    const { limit = 20, offset = 0 } = options;

    const conversations = await this.prisma.aIConversation.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        contextType: true,
        lastMessageAt: true,
        messageCount: true,
        createdAt: true,
      },
    });

    return conversations;
  }

  async getConversationDetail(userId: string, conversationId: string): Promise<ConversationDetailDto> {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: MAX_MESSAGES_PER_CONVERSATION,
          select: {
            id: true,
            role: true,
            content: true,
            safetyLevel: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      id: conversation.id,
      title: conversation.title,
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      messages: conversation.messages,
    };
  }

  async recordMessages(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    options: {
      safetyLevel?: AISafetyLevel;
      promptVersion?: string;
      model?: string;
    } = {},
  ) {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new ForbiddenException('Conversation not accessible');
    }

    await this.prisma.$transaction([
      this.prisma.aIMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: userMessage.slice(0, 4000),
        },
      }),
      this.prisma.aIMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: assistantMessage.slice(0, 4000),
          safetyLevel: options.safetyLevel || null,
          promptVersion: options.promptVersion || null,
          model: options.model || null,
        },
      }),
      this.prisma.aIConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 2 },
        },
      }),
    ]);
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.aIConversation.delete({
      where: { id: conversationId },
    });

    this.logger.log(`Conversation deleted: ${conversationId}`);
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.aIConversation.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    this.logger.log(`Cleaned up ${result.count} expired conversations`);
    return result.count;
  }
}
