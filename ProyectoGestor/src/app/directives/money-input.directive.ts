import { AfterViewInit, Directive, ElementRef, HostListener } from '@angular/core';
import { formatMoneyNumber, parseMoneyNumber } from '../services/money-format';

@Directive({
  selector: 'ion-input[appMoneyInput]',
  standalone: true,
})
export class MoneyInputDirective implements AfterViewInit {
  constructor(private elementRef: ElementRef<HTMLIonInputElement>) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.applyFormattedValue(false), 0);
  }

  @HostListener('ionFocus')
  onFocus(): void {
    const parsed = parseMoneyNumber(this.getCurrentValue());
    const editableValue = parsed === null ? '' : String(parsed);
    this.setValue(editableValue, false);
  }

  @HostListener('ionBlur')
  onBlur(): void {
    this.applyFormattedValue(true);
  }

  private applyFormattedValue(emitEvents: boolean): void {
    const formatted = formatMoneyNumber(this.getCurrentValue());
    this.setValue(formatted, emitEvents);
  }

  private getCurrentValue(): string {
    const value = (this.elementRef.nativeElement as any).value;
    return String(value ?? '').trim();
  }

  private setValue(value: string, emitEvents: boolean): void {
    const input = this.elementRef.nativeElement as any;
    input.value = value;

    if (!emitEvents) {
      return;
    }

    input.dispatchEvent(
      new CustomEvent('ionInput', {
        detail: { value },
        bubbles: true,
      })
    );

    input.dispatchEvent(
      new CustomEvent('ionChange', {
        detail: { value },
        bubbles: true,
      })
    );
  }
}
