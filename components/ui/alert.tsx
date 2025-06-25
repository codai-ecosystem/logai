'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Alert Component
const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-gray-950 dark:[&>svg]:text-gray-50',
  {
    variants: {
      variant: {
        default:
          'bg-white text-gray-950 border-gray-200 dark:bg-gray-950 dark:text-gray-50 dark:border-gray-800',
        destructive:
          'border-red-500/50 text-red-900 dark:border-red-500 [&>svg]:text-red-600 dark:border-red-900/50 dark:text-red-50 dark:dark:border-red-900 dark:[&>svg]:text-red-400 bg-red-50 dark:bg-red-950/30',
        success:
          'border-green-500/50 text-green-900 dark:border-green-500 [&>svg]:text-green-600 dark:border-green-900/50 dark:text-green-50 dark:dark:border-green-900 dark:[&>svg]:text-green-400 bg-green-50 dark:bg-green-950/30',
        warning:
          'border-yellow-500/50 text-yellow-900 dark:border-yellow-500 [&>svg]:text-yellow-600 dark:border-yellow-900/50 dark:text-yellow-50 dark:dark:border-yellow-900 dark:[&>svg]:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30',
        info: 'border-blue-500/50 text-blue-900 dark:border-blue-500 [&>svg]:text-blue-600 dark:border-blue-900/50 dark:text-blue-50 dark:dark:border-blue-900 dark:[&>svg]:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Icons
const InfoIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={cn('h-4 w-4', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const CheckCircleIcon = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={cn('h-4 w-4', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="M9 11l3 3L22 4" />
  </svg>
);

const AlertTriangleIcon = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={cn('h-4 w-4', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const XCircleIcon = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={cn('h-4 w-4', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6" />
    <path d="M9 9l6 6" />
  </svg>
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

// Predefined Alert Components
const ErrorAlert = ({
  title,
  description,
  ...props
}: {
  title?: string;
  description: string;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <Alert variant="destructive" {...props}>
    <XCircleIcon />
    {title && <AlertTitle>{title}</AlertTitle>}
    <AlertDescription>{description}</AlertDescription>
  </Alert>
);

const SuccessAlert = ({
  title,
  description,
  ...props
}: {
  title?: string;
  description: string;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <Alert variant="success" {...props}>
    <CheckCircleIcon />
    {title && <AlertTitle>{title}</AlertTitle>}
    <AlertDescription>{description}</AlertDescription>
  </Alert>
);

const WarningAlert = ({
  title,
  description,
  ...props
}: {
  title?: string;
  description: string;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <Alert variant="warning" {...props}>
    <AlertTriangleIcon />
    {title && <AlertTitle>{title}</AlertTitle>}
    <AlertDescription>{description}</AlertDescription>
  </Alert>
);

const InfoAlert = ({
  title,
  description,
  ...props
}: {
  title?: string;
  description: string;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <Alert variant="info" {...props}>
    <InfoIcon />
    {title && <AlertTitle>{title}</AlertTitle>}
    <AlertDescription>{description}</AlertDescription>
  </Alert>
);

export {
  Alert,
  AlertTitle,
  AlertDescription,
  ErrorAlert,
  SuccessAlert,
  WarningAlert,
  InfoAlert,
};
