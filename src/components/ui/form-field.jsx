import { Children, cloneElement, isValidElement } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Label, control, helper text and error message in one block. The control gets the
 * matching id, aria-describedby and aria-invalid, so screen readers read the hint and
 * the error with the field.
 */
export default function FormField({ id, label, hint, error, required, optional, className, children }) {
  const hintId = hint ? id + '-hint' : undefined;
  const errorId = error ? id + '-error' : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const control = Children.only(children);
  const field = isValidElement(control)
    ? cloneElement(control, {
        id: control.props.id || id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })
    : control;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
        </Label>
      ) : null}
      {field}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger-subtle-foreground">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
