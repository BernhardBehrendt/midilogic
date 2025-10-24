import { Routes } from '@angular/router';
import { DefaultLayoutComponent } from './layouts/default.layout';

export const routes: Routes = [
  {
    path: '',
    component: DefaultLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'lab',
        loadComponent: () => import('./components/lab/lab.component').then((m) => m.LabComponent),
      },
      {
        path: 'matrix',
        loadComponent: () => import('./pages/matrix/matrix').then((m) => m.Matrix),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsComponent),
      },
      {
        path: 'offline-demo',
        loadComponent: () =>
          import('./pages/offline-demo/offline-demo').then((m) => m.OfflineDemoComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/home',
  },
];
