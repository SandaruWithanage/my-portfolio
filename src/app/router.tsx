import type { RouteObject } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { HubPage } from '../features/hub/HubPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { EngineeringPage } from '../pages/EngineeringPage'
import { BackgroundPage } from '../pages/BackgroundPage'
import { ContactPage } from '../pages/ContactPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const routes: RouteObject[] = [
  // The command-centre hub has no site header; every other route keeps the layout
  // (with the HUD bar) and still loads directly by URL.
  { path: '/', element: <HubPage /> },
  {
    element: <Layout />,
    children: [
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:slug', element: <ProjectDetailPage /> },
      { path: 'engineering', element: <EngineeringPage /> },
      { path: 'background', element: <BackgroundPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
