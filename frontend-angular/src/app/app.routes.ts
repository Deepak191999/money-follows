import { Routes } from '@angular/router';
import { authGuard } from './shared/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'groups' },
  { path: 'login', loadComponent: () => import('./login/login').then((m) => m.Login) },
  {
    path: 'groups',
    canActivate: [authGuard],
    loadComponent: () => import('./groups/groups').then((m) => m.Groups),
  },
  {
    path: 'groups/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./group/group').then((m) => m.Group),
  },
  {
    path: 'me',
    canActivate: [authGuard],
    loadComponent: () => import('./me/me').then((m) => m.Me),
  },
  { path: '**', redirectTo: 'groups' },
];
