import type { Task } from './db';
import type { IconName } from './Icon';
import { tk } from './i18n';

export type TaskKind = NonNullable<Task['kind']>;

/** The modes of a personal task. Names are Persian keys: render them with `tx()`. */
export const TASK_KINDS: { key: TaskKind; name: string; icon: IconName }[] = [
  { key: 'personal', name: tk('کار شخصی'), icon: 'users' },
  { key: 'shopping', name: tk('خرید'), icon: 'tag' },
  { key: 'errand', name: tk('کار اداری و بیرون'), icon: 'toolbox' },
  { key: 'health', name: tk('سلامت و ورزش'), icon: 'target' },
];
