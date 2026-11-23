import type { KeyboardEvent } from 'react';

/**
 * 一组「标签页」的键盘交互：左右方向键循环切换，Home/End 跳到首尾。
 * 供 role="tablist" 容器调用，焦点会跟随到新选中的标签页。
 *
 * @param event 触发键盘事件的元素（角色为 tablist 的容器）
 * @param ids 标签页顺序
 * @param currentId 当前选中的标签页
 * @param onSelect 选中回调
 */
export function handleTabListKeyDown(
  event: KeyboardEvent<HTMLElement>,
  ids: string[],
  currentId: string,
  onSelect: (id: string) => void
): void {
  if (ids.length === 0) return;
  const index = ids.indexOf(currentId);
  let nextIndex = -1;

  if (event.key === 'ArrowRight') nextIndex = (index + 1) % ids.length;
  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + ids.length) % ids.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = ids.length - 1;

  if (nextIndex < 0 || nextIndex === index) return;
  event.preventDefault();
  onSelect(ids[nextIndex]);
  const buttons = event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
  buttons[nextIndex]?.focus();
}

/** 标签页按钮的通用可访问性属性 */
export function tabA11yProps(id: string, selected: boolean) {
  return {
    role: 'tab' as const,
    id: `tab-${id}`,
    'aria-selected': selected,
    'aria-controls': `panel-${id}`,
    tabIndex: selected ? 0 : -1,
  };
}

/** 标签页内容面板的通用可访问性属性 */
export function tabPanelA11yProps(id: string) {
  return {
    role: 'tabpanel' as const,
    id: `panel-${id}`,
    'aria-labelledby': `tab-${id}`,
  };
}
