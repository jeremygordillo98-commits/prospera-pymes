import React from 'react';
import { CustomModal } from './CustomModal';

interface TesoreriaAnulacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  motivo: string;
  setMotivo: (val: string) => void;
  onConfirm: () => void;
}

export const TesoreriaAnulacionModal: React.FC<TesoreriaAnulacionModalProps> = ({
  isOpen,
  onClose,
  motivo,
  setMotivo,
  onConfirm
}) => {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Anulación"
      type="prompt"
      message="Por favor, ingresa el motivo de la anulación:"
      confirmLabel="Confirmar Anulación"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      inputValue={motivo}
      onInputChange={setMotivo}
      inputPlaceholder="Motivo de la anulación..."
    />
  );
};
