import React, { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children }) {
  const modalRef = useRef(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', handleKeyDown);

    // Focus the modal on open
    const prev = document.activeElement;
    modalRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus on close
      prev?.focus();
    };
  }, []);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
