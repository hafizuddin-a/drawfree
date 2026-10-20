import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { primary?: boolean }

export function Button({ primary, className, type = 'button', ...rest }: Props) {
  return <button type={type} className={[styles.btn, primary ? styles.primary : '', className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}
