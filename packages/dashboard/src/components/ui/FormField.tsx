import type { ComponentChildren } from 'preact'
import { forwardRef } from 'preact/compat'

export interface FormFieldProps {
  /** Field label */
  label?: string
  /** Field description or help text */
  description?: string
  /** Error message */
  error?: string
  /** Whether the field is required */
  required?: boolean
  /** Custom CSS classes for the field container */
  className?: string
  /** HTML id for the field (used for label association) */
  fieldId?: string
  /** Field content */
  children: ComponentChildren
}

export function FormField({
  label,
  description,
  error,
  required,
  className = '',
  fieldId,
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {description && !error && (
        <p id={fieldId ? `${fieldId}-description` : undefined} className="text-sm text-gray-500">
          {description}
        </p>
      )}
      {error && (
        <p
          id={fieldId ? `${fieldId}-error` : undefined}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export interface InputFieldProps {
  /** Input label */
  label?: string
  /** Input description or help text */
  description?: string
  /** Error message */
  error?: string
  /** Whether the field is required */
  required?: boolean
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  /** Input placeholder */
  placeholder?: string
  /** Input value */
  value: string
  /** Function to call when value changes */
  onChange: (value: string) => void
  /** Function to call when input is blurred */
  onBlur?: () => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Whether the input is read-only */
  readOnly?: boolean
  /** Custom CSS classes for the field container */
  className?: string
  /** Custom CSS classes for the input */
  inputClassName?: string
  /** HTML id attribute */
  id?: string
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      description,
      error,
      required,
      type = 'text',
      placeholder,
      value,
      onChange,
      onBlur,
      disabled,
      readOnly,
      className = '',
      inputClassName = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

    const baseInputClasses = `
      w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      read-only:bg-gray-50 read-only:text-gray-500
    `.trim()

    const inputClasses = error
      ? `${baseInputClasses} border-red-300 focus:ring-red-500 focus:border-red-500 ${inputClassName}`
      : `${baseInputClasses} ${inputClassName}`

    return (
      <FormField
        label={label}
        description={description}
        error={error}
        required={required}
        className={className}
        fieldId={inputId}
      >
        <input
          ref={ref}
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          onBlur={onBlur}
          disabled={disabled}
          readOnly={readOnly}
          className={inputClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${inputId}-error` : description ? `${inputId}-description` : undefined
          }
          {...props}
        />
      </FormField>
    )
  }
)

InputField.displayName = 'InputField'

export interface TextareaFieldProps {
  /** Textarea label */
  label?: string
  /** Textarea description or help text */
  description?: string
  /** Error message */
  error?: string
  /** Whether the field is required */
  required?: boolean
  /** Textarea placeholder */
  placeholder?: string
  /** Textarea value */
  value: string
  /** Function to call when value changes */
  onChange: (value: string) => void
  /** Function to call when textarea is blurred */
  onBlur?: () => void
  /** Whether the textarea is disabled */
  disabled?: boolean
  /** Whether the textarea is read-only */
  readOnly?: boolean
  /** Number of rows */
  rows?: number
  /** Custom CSS classes for the field container */
  className?: string
  /** Custom CSS classes for the textarea */
  textareaClassName?: string
  /** HTML id attribute */
  id?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  (
    {
      label,
      description,
      error,
      required,
      placeholder,
      value,
      onChange,
      onBlur,
      disabled,
      readOnly,
      rows = 3,
      className = '',
      textareaClassName = '',
      id,
      ...props
    },
    ref
  ) => {
    const textareaId =
      id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

    const baseTextareaClasses = `
      w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      read-only:bg-gray-50 read-only:text-gray-500
      resize-vertical
    `.trim()

    const textareaClasses = error
      ? `${baseTextareaClasses} border-red-300 focus:ring-red-500 focus:border-red-500 ${textareaClassName}`
      : `${baseTextareaClasses} ${textareaClassName}`

    return (
      <FormField
        label={label}
        description={description}
        error={error}
        required={required}
        className={className}
        fieldId={textareaId}
      >
        <textarea
          ref={ref}
          id={textareaId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
          onBlur={onBlur}
          disabled={disabled}
          readOnly={readOnly}
          rows={rows}
          className={textareaClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${textareaId}-error` : description ? `${textareaId}-description` : undefined
          }
          {...props}
        />
      </FormField>
    )
  }
)

TextareaField.displayName = 'TextareaField'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectFieldProps {
  /** Select label */
  label?: string
  /** Select description or help text */
  description?: string
  /** Error message */
  error?: string
  /** Whether the field is required */
  required?: boolean
  /** Select placeholder */
  placeholder?: string
  /** Select value */
  value: string
  /** Function to call when value changes */
  onChange: (value: string) => void
  /** Function to call when select is blurred */
  onBlur?: () => void
  /** Whether the select is disabled */
  disabled?: boolean
  /** Select options */
  options: SelectOption[]
  /** Custom CSS classes for the field container */
  className?: string
  /** Custom CSS classes for the select */
  selectClassName?: string
  /** HTML id attribute */
  id?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      label,
      description,
      error,
      required,
      placeholder,
      value,
      onChange,
      onBlur,
      disabled,
      options,
      className = '',
      selectClassName = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId =
      id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

    const baseSelectClasses = `
      w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      bg-white
    `.trim()

    const selectClasses = error
      ? `${baseSelectClasses} border-red-300 focus:ring-red-500 focus:border-red-500 ${selectClassName}`
      : `${baseSelectClasses} ${selectClassName}`

    return (
      <FormField
        label={label}
        description={description}
        error={error}
        required={required}
        className={className}
        fieldId={selectId}
      >
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
          onBlur={onBlur}
          disabled={disabled}
          className={selectClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${selectId}-error` : description ? `${selectId}-description` : undefined
          }
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
    )
  }
)

SelectField.displayName = 'SelectField'
