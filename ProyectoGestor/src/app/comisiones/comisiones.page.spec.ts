import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComisionesPage } from './comisiones.page';

describe('ComisionesPage', () => {
  let component: ComisionesPage;
  let fixture: ComponentFixture<ComisionesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ComisionesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
