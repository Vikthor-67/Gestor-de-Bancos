import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransaccionFormPage } from './transaccion-form.page';

describe('TransaccionFormPage', () => {
  let component: TransaccionFormPage;
  let fixture: ComponentFixture<TransaccionFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TransaccionFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
