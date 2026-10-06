import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getToken } from './token';

export const authGuard: CanActivateFn = () => {
  if (getToken()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login']);
};
