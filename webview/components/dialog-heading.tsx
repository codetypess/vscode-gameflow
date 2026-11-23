import type { ComponentPropsWithoutRef } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";

interface DialogHeadingProps extends ComponentPropsWithoutRef<"header"> {
  heading: string;
  headingId?: string;
  closeLabel?: string;
  onClose: () => void;
  closeDisabled?: boolean;
}

export function DialogHeading({ heading, headingId, closeLabel, onClose, closeDisabled, children, ...props }: DialogHeadingProps) {
  return <header {...props} className="floating-heading dialog-heading">
    <strong id={headingId} title={heading}>{heading}</strong>
    {children}
    <Button type="button" size="icon" variant="ghost" className="dialog-close" aria-label={closeLabel ?? `关闭${heading}`} disabled={closeDisabled} onClick={onClose}><X size={14} /></Button>
  </header>;
}
