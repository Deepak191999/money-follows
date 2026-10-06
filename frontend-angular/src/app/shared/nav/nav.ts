import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService, User } from '../api.service';
import { clearToken } from '../token';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav>
      <a routerLink="/groups" class="brand">Money Follows</a>
      <a routerLink="/groups" routerLinkActive="active">Groups</a>
      <a routerLink="/me" routerLinkActive="active">Me</a>
      <span class="spacer"></span>
      <span>{{ user()?.name }}</span>
      <button type="button" class="link" (click)="logout()">Log out</button>
    </nav>
  `,
  styles: `
    nav {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #ddd;
      margin-bottom: 1.5rem;
    }
    .brand {
      font-weight: 600;
      margin-right: 1rem;
    }
    .spacer {
      flex: 1;
    }
    .active {
      text-decoration: underline;
    }
  `,
})
export class Nav {
  private api = inject(ApiService);
  private router = inject(Router);
  user = signal<User | null>(null);

  constructor() {
    this.api.me().subscribe((u) => this.user.set(u));
  }

  logout() {
    clearToken();
    this.router.navigate(['/login']);
  }
}
