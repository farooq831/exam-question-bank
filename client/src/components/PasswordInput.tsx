import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Start with the password visible (used for administrator-generated temporary passwords). */
  initiallyVisible?: boolean;
  wrapperClassName?: string;
}

/** Password field with an eye button to show or hide what has been typed. */
export function PasswordInput({ initiallyVisible = false, className = '', wrapperClassName = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(initiallyVisible);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-12!`} autoCapitalize="none" spellCheck={false} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 hover:text-ink"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
