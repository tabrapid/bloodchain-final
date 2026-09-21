import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderLocalized } from '../lib/test-render';

const getScreeningOrders = vi.fn();
const getScreeningOrder = vi.fn();
const recordScreeningResult = vi.fn();
const reviewScreeningResult = vi.fn();
const correctScreeningResult = vi.fn();

vi.mock('../lib/screening', async () => {
  const actual = await vi.importActual<typeof import('../lib/screening')>('../lib/screening');
  return {
    ...actual,
    getScreeningOrders: (...args: unknown[]) => getScreeningOrders(...args),
    getScreeningOrder: (...args: unknown[]) => getScreeningOrder(...args),
    recordScreeningResult: (...args: unknown[]) => recordScreeningResult(...args),
    reviewScreeningResult: (...args: unknown[]) => reviewScreeningResult(...args),
    correctScreeningResult: (...args: unknown[]) => correctScreeningResult(...args),
  };
});

import { ScreeningPanel } from './ScreeningPanel';

/**
 * What the screening console must show an operator, and what it must never do.
 *
 * The three properties below are the ones a plausible implementation gets
 * wrong: folding "no rule describes this code" in with "needs review", letting
 * somebody review their own result, and reporting a correction without saying
 * whether it opened a recall.
 */
describe('ScreeningPanel', () => {
  const order = {
    id: 'order-1',
    orderReference: 'SCR-2026-000001',
    status: 'IN_PROGRESS' as const,
    donationId: 'donation-1',
    donationReference: 'DONATION-2026-000123',
    sample: null,
    policyId: 'policy-1',
    policyVersion: 3,
    policyTitle: 'Policy',
    developmentOnly: false,
    requestedAt: '2026-09-20T10:00:00.000Z',
    systemRaised: true,
    completedAt: null,
    reviewedAt: null,
    resultCount: 1,
    reviewedResultCount: 0,
  };

  function detail(result: Record<string, unknown> | null) {
    return {
      id: 'order-1',
      orderReference: 'SCR-2026-000001',
      status: 'IN_PROGRESS',
      donation: {
        id: 'donation-1',
        donationReference: 'DONATION-2026-000123',
        donorId: 'donor-1',
        completedAt: '2026-09-20T09:00:00.000Z',
      },
      sample: null,
      policy: {
        id: 'policy-1',
        title: 'Policy',
        kind: 'PRODUCTION',
        developmentOnly: false,
        currentVersion: 3,
        requiresResultReview: true,
      },
      policyVersion: 3,
      requestedAt: '2026-09-20T10:00:00.000Z',
      systemRaised: true,
      completedAt: null,
      reviewedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      requirements: [
        {
          code: 'REQ-A',
          description: 'A requirement',
          componentType: null,
          screeningTestCode: null,
          result,
        },
      ],
      supersededResults: [],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getScreeningOrders.mockResolvedValue([order]);
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the pinned policy version on the worklist', async () => {
    renderLocalized(<ScreeningPanel organizationId="org-1" currentUserName="Ada Lovelace" />);

    expect(await screen.findByText('SCR-2026-000001')).toBeInTheDocument();
    // An order raised under v3 asked for what v3 required, and says so without
    // anybody opening it.
    expect(screen.getByText('v3')).toBeInTheDocument();
  });

  it('keeps "no rule describes this code" apart from "needs review"', async () => {
    // The state that must not be folded in with the others: a null
    // dispositionPolicyVersion means the system defaulted rather than being
    // told, which is a configuration gap and not a clinical finding.
    getScreeningOrder.mockResolvedValue(
      detail({
        id: 'result-1',
        resultCode: 'SOMETHING-NOBODY-MAPPED',
        resultValue: null,
        disposition: 'REVIEW_REQUIRED',
        dispositionPolicyVersion: null,
        source: 'MANUAL',
        performedAt: '2026-09-20T11:00:00.000Z',
        performedByName: 'Grace Hopper',
        reviewedAt: null,
        reviewedByName: null,
        comment: null,
      }),
    );

    renderLocalized(<ScreeningPanel organizationId="org-1" currentUserName="Ada Lovelace" />);
    await userEvent.click(await screen.findByRole('button', { name: /view details/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/not interpreted by the policy/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/^Awaiting review$/i)).not.toBeInTheDocument();
  });

  it('does not offer to review a result you recorded yourself', async () => {
    getScreeningOrder.mockResolvedValue(
      detail({
        id: 'result-1',
        resultCode: 'CODE-PASS',
        resultValue: null,
        disposition: 'CLEAR',
        dispositionPolicyVersion: 3,
        source: 'MANUAL',
        performedAt: '2026-09-20T11:00:00.000Z',
        performedByName: 'Ada Lovelace',
        reviewedAt: null,
        reviewedByName: null,
        comment: null,
      }),
    );

    renderLocalized(<ScreeningPanel organizationId="org-1" currentUserName="Ada Lovelace" />);
    await userEvent.click(await screen.findByRole('button', { name: /view details/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /^Review$/i })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/somebody else has to review it/i)).toBeInTheDocument();
  });

  it('offers review to a different person', async () => {
    getScreeningOrder.mockResolvedValue(
      detail({
        id: 'result-1',
        resultCode: 'CODE-PASS',
        resultValue: null,
        disposition: 'CLEAR',
        dispositionPolicyVersion: 3,
        source: 'MANUAL',
        performedAt: '2026-09-20T11:00:00.000Z',
        performedByName: 'Grace Hopper',
        reviewedAt: null,
        reviewedByName: null,
        comment: null,
      }),
    );

    renderLocalized(<ScreeningPanel organizationId="org-1" currentUserName="Ada Lovelace" />);
    await userEvent.click(await screen.findByRole('button', { name: /view details/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /^Review$/i })).toBeInTheDocument();
  });

  it('says whether a correction opened a recall, in the page rather than an alert', async () => {
    getScreeningOrder.mockResolvedValue(
      detail({
        id: 'result-1',
        resultCode: 'CODE-PASS',
        resultValue: null,
        disposition: 'CLEAR',
        dispositionPolicyVersion: 3,
        source: 'MANUAL',
        performedAt: '2026-09-20T11:00:00.000Z',
        performedByName: 'Grace Hopper',
        reviewedAt: '2026-09-20T12:00:00.000Z',
        reviewedByName: 'Ada Lovelace',
        comment: null,
      }),
    );
    correctScreeningResult.mockResolvedValue({
      id: 'result-2',
      supersededResultId: 'result-1',
      resultCode: 'CODE-BLOCK',
      disposition: 'BLOCK',
      dispositionMapped: true,
      recallOpened: true,
      recallCaseId: 'case-1',
      releasedComponentsAtCorrection: 2,
      medicalReviewOpened: true,
    });

    renderLocalized(<ScreeningPanel organizationId="org-1" currentUserName="Ada Lovelace" />);
    await userEvent.click(await screen.findByRole('button', { name: /view details/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Correct$/i }));

    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[inputs.length - 2]!, 'CODE-BLOCK');
    await userEvent.type(inputs[inputs.length - 1]!, 'Transcription error');
    await userEvent.click(screen.getAllByRole('button', { name: /^Correct$/i }).at(-1)!);

    await waitFor(() =>
      expect(screen.getByText(/A recall has been opened/i)).toBeInTheDocument(),
    );
    // The two consequences an operator must not have to infer.
    expect(screen.getByText(/medical review has been opened/i)).toBeInTheDocument();
    // And nothing was shouted through a browser dialog, which is untranslated,
    // unstyled and gone the moment it is dismissed.
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('reports a correction that opened no recall, and why not', async () => {
    getScreeningOrder.mockResolvedValue(
      detail({
        id: 'result-1',
        resultCode: 'CODE-PASS',
        resultValue: null,
        disposition: 'CLEAR',
        dispositionPolicyVersion: 3,
        source: 'MANUAL',
        performedAt: '2026-09-20T11:00:00.000Z',
        performedByName: 'Grace Hopper',
        reviewedAt: null,
        reviewedByName: null,
        comment: null,
      }),
    );
    correctScreeningResult.mockResolvedValue({
      id: 'result-2',
      supersededResultId: 'result-1',
      resultCode: 'CODE-BLOCK',
      disposition: 'BLOCK',
      dispositionMapped: true,
      recallOpened: false,
      recallCaseId: null,
      releasedComponentsAtCorrection: 0,
      medicalReviewOpened: false,
    });

    renderLocalized(<ScreeningPanel organizationId="org-1" currentUserName="Ada Lovelace" />);
    await userEvent.click(await screen.findByRole('button', { name: /view details/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Correct$/i }));

    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[inputs.length - 2]!, 'CODE-BLOCK');
    await userEvent.type(inputs[inputs.length - 1]!, 'Transcription error');
    await userEvent.click(screen.getAllByRole('button', { name: /^Correct$/i }).at(-1)!);

    await waitFor(() => expect(screen.getByText(/No recall was opened/i)).toBeInTheDocument());
  });
});
