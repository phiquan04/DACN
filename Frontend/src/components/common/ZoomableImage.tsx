import { useState } from "react";
import { Modal } from "../ui/modal";

type ZoomableImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

// Drop-in replacement for <img> that opens the full-size image in a modal on
// click. Stops click propagation so it's safe to use inside rows/cards that
// have their own onClick (e.g. a table row that navigates elsewhere).
export default function ZoomableImage({ className, onClick, ...rest }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        {...rest}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
          onClick?.(e);
        }}
        className={`cursor-zoom-in ${className ?? ""}`}
      />
      <Modal isOpen={open} onClose={() => setOpen(false)} className="m-4 max-w-3xl p-3">
        <img src={rest.src} alt={rest.alt ?? ""} className="max-h-[80vh] w-full rounded-xl object-contain" />
      </Modal>
    </>
  );
}
