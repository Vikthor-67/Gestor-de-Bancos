import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransaccionDetallePage } from './transaccion-detalle.page';

describe('TransaccionDetallePage', () => {
  let component: TransaccionDetallePage;
  let fixture: ComponentFixture<TransaccionDetallePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TransaccionDetallePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
