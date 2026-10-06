import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Group, apiError } from '../shared/api.service';
import { Nav } from '../shared/nav/nav';

@Component({
  selector: 'app-groups',
  imports: [FormsModule, RouterLink, Nav],
  templateUrl: './groups.html',
})
export class Groups {
  private api = inject(ApiService);
  groups = signal<Group[]>([]);
  name = '';
  busy = signal(false);
  error = signal('');

  constructor() {
    this.load();
  }

  load() {
    this.api.groups().subscribe({
      next: (groups) => this.groups.set(groups),
      error: (err) => this.error.set(apiError(err)),
    });
  }

  create() {
    this.busy.set(true);
    this.error.set('');
    this.api.createGroup(this.name).subscribe({
      next: (group) => {
        this.busy.set(false);
        this.name = '';
        this.groups.update((list) => [...list, group]);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(apiError(err));
      },
    });
  }
}
