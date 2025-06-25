'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Input Component
const inputVariants = cva(
  'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-blue-300',
  {
    variants: {
      variant: {
        default: '',
        destructive:
          'border-red-500 focus-visible:ring-red-500 dark:border-red-900 dark:focus-visible:ring-red-900',
        success:
          'border-green-500 focus-visible:ring-green-500 dark:border-green-900 dark:focus-visible:ring-green-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, variant, type, label, description, error, success, ...props },
    ref
  ) => {
    const inputId = React.useId();
    const descriptionId = React.useId();
    const errorId = React.useId();
    const successId = React.useId();

    const computedVariant = error
      ? 'destructive'
      : success
        ? 'success'
        : variant;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(inputVariants({ variant: computedVariant, className }))}
          ref={ref}
          aria-describedby={
            description
              ? descriptionId
              : error
                ? errorId
                : success
                  ? successId
                  : undefined
          }
          {...props}
        />
        {description && (
          <p
            id={descriptionId}
            className="mt-2 text-sm text-gray-600 dark:text-gray-400"
          >
            {description}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="mt-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            id={successId}
            className="mt-2 text-sm text-green-600 dark:text-green-400"
          >
            {success}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Textarea Component
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, description, error, success, ...props }, ref) => {
    const textareaId = React.useId();
    const descriptionId = React.useId();
    const errorId = React.useId();
    const successId = React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-blue-300',
            error &&
              'border-red-500 focus-visible:ring-red-500 dark:border-red-900 dark:focus-visible:ring-red-900',
            success &&
              'border-green-500 focus-visible:ring-green-500 dark:border-green-900 dark:focus-visible:ring-green-900',
            className
          )}
          ref={ref}
          aria-describedby={
            description
              ? descriptionId
              : error
                ? errorId
                : success
                  ? successId
                  : undefined
          }
          {...props}
        />
        {description && (
          <p
            id={descriptionId}
            className="mt-2 text-sm text-gray-600 dark:text-gray-400"
          >
            {description}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="mt-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            id={successId}
            className="mt-2 text-sm text-green-600 dark:text-green-400"
          >
            {success}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export { Input, Textarea };
