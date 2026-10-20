import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { primary?: boolean }

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ primary, className, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={[styles.btn, primary ? styles.primary : '', className ?? ''].filter(Boolean).join(' ')} {...rest} />;
});
