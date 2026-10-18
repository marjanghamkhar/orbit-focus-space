import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, children, action, compact }: EmptyStateProps) {
  return (
    <div className={`empty ${compact ? 'empty--compact' : ''}`}>
      <div className="empty__icon">
        <Icon name={icon} size={compact ? 20 : 24} />
      </div>
      <p className="empty__title">{title}</p>
      {children && <p className="empty__text">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
