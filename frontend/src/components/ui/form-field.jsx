import { createContext, useContext } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const FieldContext = createContext(null);

/**
 * Props a control inside a FormField should carry: the field id, aria-describedby for the
 * hint and error, and aria-invalid. Explicit props on the control win.
 */
export function useFieldProps(props) {
  const field = useContext(FieldContext);
  if (!field) return props;
  return {
    ...props,
    id: props.id || field.id,
    'aria-describedby': props['aria-describedby'] || field.describedBy,
    'aria-invalid': props['aria-invalid'] !== undefined ? props['aria-invalid'] : field.invalid,
    'aria-required': props['aria-required'] !== undefined ? props['aria-required'] : field.required,
  };
}

/**
 * Label, control, helper text and error message in one block. Input, Textarea and
 * SelectTrigger pick up the id and aria attributes from here, so screen readers read the
 * hint and the error together with the field.
 */
export default function FormField({ id, label, hint, error, required, optional, className, children }) {
  const hintId = hint ? id + '-hint' : undefined;
  const errorId = error ? id + '-error' : undefined;
  const value = {
    id,
    describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined,
    invalid: error ? true : undefined,
    required: required ? true : undefined,
  };

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('space-y-1.5', className)}>
        {label ? (
          <Label htmlFor={id}>
            {label}
            {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
          </Label>
        ) : null}
        {children}
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
    </FieldContext.Provider>
  );
}
