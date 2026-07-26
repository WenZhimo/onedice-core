import type { DiceDisplayGroup } from './explain'

export interface DiceResultRenderOptions {
  emptyText?: string
  resultLabel?: string
  rerollLabel?: string
  showReroll?: boolean
  showValue?: boolean
  value?: number | string
}

export interface DiceResultWidgetOptions extends DiceResultRenderOptions {
  onReroll?: () => void
}

export function renderDiceResult(
  container: HTMLElement,
  groups: DiceDisplayGroup[],
  options: DiceResultWidgetOptions = {},
) {
  container.innerHTML = diceResultToHtml(groups, {
    ...options,
    showReroll: Boolean(options.onReroll),
  })

  const rerollButton = container.querySelector<HTMLButtonElement>('[data-dice-reroll]')
  if (rerollButton && options.onReroll) {
    rerollButton.addEventListener('click', options.onReroll)
  }
}

export function renderDiceGroups(
  container: HTMLElement,
  groups: DiceDisplayGroup[],
  options: DiceResultRenderOptions = {},
) {
  renderDiceResult(container, groups, options)
}

export function diceResultToHtml(
  groups: DiceDisplayGroup[],
  options: DiceResultRenderOptions = {},
): string {
  return [
    '<div class="dice-result-widget">',
    diceResultHeaderToHtml(options),
    diceGroupsToHtml(groups, options),
    '</div>',
  ].join('')
}

function diceResultHeaderToHtml(options: DiceResultRenderOptions): string {
  if (!options.showValue && !options.showReroll) return ''

  return [
    '<div class="dice-result-toolbar">',
    options.showValue
      ? [
        '<div class="example-result-summary">',
        `<span>${escapeHtml(options.resultLabel ?? '结果值')}</span>`,
        `<strong>${escapeHtml(String(options.value ?? '-'))}</strong>`,
        '</div>',
      ].join('')
      : '<span></span>',
    options.showReroll
      ? `<button class="reroll-button" type="button" data-dice-reroll>${escapeHtml(options.rerollLabel ?? '重投')}</button>`
      : '',
    '</div>',
  ].join('')
}

export function diceGroupsToHtml(
  groups: DiceDisplayGroup[],
  options: DiceResultRenderOptions = {},
): string {
  if (groups.length === 0) {
    return `<p class="empty-state">${escapeHtml(options.emptyText ?? '本次表达式没有可拆分展示的骰子结果。')}</p>`
  }

  return groups
    .map(group => [
      '<article class="dice-group">',
      '<div class="dice-group-title">',
      `<span>${escapeHtml(group.title)}</span>`,
      `<code>${escapeHtml(group.expression)}</code>`,
      '</div>',
      '<div class="dice-row">',
      ...group.dice.map(die => [
        `<span class="die${die.dropped ? ' dropped' : ''}${die.selected ? ' selected' : ''}" aria-label="${escapeHtml(dieAriaLabel(die))}">`,
        `<strong>${escapeHtml(String(die.value))}</strong>`,
        `<small>${escapeHtml(die.label)}${die.sides ? ` / d${die.sides}` : ''}</small>`,
        die.source ? `<em>${escapeHtml(die.source)}</em>` : '',
        die.randomCall ? `<em>#${die.randomCall}</em>` : '',
        '</span>',
      ].join('')),
      '</div>',
      '</article>',
    ].join(''))
    .join('')
}

export function dieAriaLabel(die: DiceDisplayGroup['dice'][number]): string {
  const parts = [
    die.label,
    `点数 ${die.value}`,
    die.sides ? `${die.sides} 面骰` : '',
    die.selected === false || die.dropped ? '未计入结果' : '计入结果',
    die.source ?? '',
    die.randomCall ? `随机调用 ${die.randomCall}` : '',
  ].filter(Boolean)

  return parts.join('，')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}
