import { PropsWithChildren } from 'react';
import { Modal } from './Modal';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: PropsWithChildren<BottomSheetProps>) {
  // Phase 1 placeholder: render as a centered modal until native bottom sheet is needed.
  return (
    <Modal visible={visible} onClose={onClose} title={title}>
      {children}
    </Modal>
  );
}
