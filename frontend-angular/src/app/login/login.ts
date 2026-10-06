import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, AuthResponse, apiError } from '../shared/api.service';
import { setToken } from '../shared/token';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
})
export class Login {
  private api = inject(ApiService);
  private router = inject(Router);

  signup = signal(false);
  name = '';
  email = '';
  password = '';
  busy = signal(false);
  error = signal('');

  submit() {
    this.busy.set(true);
    this.error.set('');
    const request = this.signup()
      ? this.api.signup({ name: this.name, email: this.email, password: this.password })
      : this.api.login({ email: this.email, password: this.password });
    request.subscribe({
      next: (res: AuthResponse) => {
        setToken(res.token);
        this.router.navigate(['/groups']);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(apiError(err));
      },
    });
  }
}
