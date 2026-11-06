import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Appointments } from './Bookings';
import * as api from '../lib/api/appointments';
vi.mock('../lib/api/appointments', () => ({
  getMyAppointments: vi.fn(),
  getAvailability: vi.fn(),
  bookAppointment: vi.fn(),
  rescheduleAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getMyAppointments).mockResolvedValue([]);
  vi.mocked(api.getAvailability).mockResolvedValue([
    {
      id: 'slot-1',
      organizationId: 'center',
      organization: { id: 'center', name: 'Qon markazi', type: 'BLOOD_CENTER' },
      appointmentType: 'BLOOD_DONATION',
      startAt: '2027-01-01T05:00:00Z',
      endAt: '2027-01-01T06:00:00Z',
      capacity: 5,
      availableSpots: 2,
      status: 'AVAILABLE',
    },
  ]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
describe('donor booking', () => {
  it('submits the selected real slot and refreshes the donor worklist', async () => {
    vi.mocked(api.bookAppointment).mockResolvedValue({ id: 'appointment' } as api.Appointment);
    render(<Appointments />);
    await userEvent.click(await screen.findByRole('button', { name: 'Vaqtni tanlash' }));
    expect(api.bookAppointment).toHaveBeenCalledWith({
      slotId: 'slot-1',
      appointmentType: 'BLOOD_DONATION',
    });
    await screen.findByText('Qabul saqlandi.');
    expect(api.getMyAppointments).toHaveBeenCalledTimes(2);
  });
  it('shows a server conflict instead of claiming the reservation succeeded', async () => {
    vi.mocked(api.bookAppointment).mockRejectedValue(new Error('Bu vaqt allaqachon band'));
    render(<Appointments />);
    await userEvent.click(await screen.findByRole('button', { name: 'Vaqtni tanlash' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Bu vaqt allaqachon band'),
    );
    expect(screen.queryByText('Qabul saqlandi.')).not.toBeInTheDocument();
  });
  it('does not book without the donor confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Appointments />);
    await userEvent.click(await screen.findByRole('button', { name: 'Vaqtni tanlash' }));
    expect(api.bookAppointment).not.toHaveBeenCalled();
  });
});
