import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeferralKind } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeferralDto {
  @ApiProperty({ enum: DeferralKind })
  @IsEnum(DeferralKind)
  kind!: DeferralKind;

  /**
   * A code from the operator's own deferral vocabulary.
   *
   * Free-form on purpose and validated only for length: this repository ships
   * no deferral reason list, and constraining the field to one it invented
   * would be exactly the clinical rule Sprint 7 forbids. The reviewer pack asks
   * for the real vocabulary (clinical-review.md, CR-04).
   */
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;

  /**
   * Confidential clinical note. Visible only to staff of the organisation that
   * raised the deferral, never across an organisation boundary, and never to
   * the donor.
   */
  @ApiPropertyOptional({
    description:
      'Confidential clinical note. Readable only by staff of the organization that raised the deferral.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  confidentialNote?: string;

  /** Required for a TEMPORARY deferral; refused for an INDEFINITE one. */
  @ApiPropertyOptional({ description: 'ISO date. Required when kind is TEMPORARY.' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class LiftDeferralDto {
  @ApiProperty({ description: 'Why this deferral is being lifted. Recorded against the row and the audit log.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
