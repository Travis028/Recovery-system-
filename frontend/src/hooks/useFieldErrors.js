import { useCallback, useState } from 'react';

/**
 * Decides when a validation message is shown: after the user leaves a field, or for every
 * field once they try to submit. The messages themselves come from the form's own checks.
 *
 *   const errors = collectErrors({ email: () => checkEmail(form.email) });
 *   const fields = useFieldErrors(errors);
 *   <FormField error={fields.show('email')}><Input onBlur={fields.touch('email')} /></FormField>
 *   onSubmit: if (!fields.submit()) return;
 */
export default function useFieldErrors(errors) {
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const touch = useCallback(function (field) {
    return function () {
      setTouched(function (previous) {
        return previous[field] ? previous : { ...previous, [field]: true };
      });
    };
  }, []);

  const show = function (field) {
    return submitted || touched[field] ? errors[field] || '' : '';
  };

  // Returns true when the form may be sent; otherwise reveals every message.
  const submit = function () {
    setSubmitted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      const element = document.getElementById(first);
      if (element) element.focus();
      return false;
    }
    return true;
  };

  const reset = useCallback(function () {
    setTouched({});
    setSubmitted(false);
  }, []);

  return { show, touch, submit, reset, valid: Object.keys(errors).length === 0 };
}
