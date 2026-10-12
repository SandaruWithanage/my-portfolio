export const profile = {
  name: 'Sandaru Withanage',
  role: 'Full Stack Engineer',
  tagline: 'Engineering, made visible.',
  summary:
    'I design and build full-stack systems, from database-level security to responsive interfaces. My main project is EduVerse, a multi-tenant school-management SaaS running in production.',
  email: 'sandaruvithanage.dev@gmail.com',
  github: 'https://github.com/SandaruWithanage',
  linkedin: 'https://www.linkedin.com/in/sandarux',
  site: 'https://eduverse.site',
  location: 'Sri Lanka',
} as const

export const skills: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['TypeScript', 'JavaScript', 'C#', 'Java', 'PHP', 'Python', 'SQL'] },
  {
    group: 'Backend',
    items: ['NestJS', 'Node.js', 'Laravel', '.NET', 'Spring Boot', 'REST', 'GraphQL', 'gRPC', 'Prisma'],
  },
  { group: 'Frontend', items: ['Next.js', 'React', 'Angular', 'Tailwind CSS', 'Three.js'] },
  {
    group: 'Data',
    items: [
      'PostgreSQL (Row-Level Security)',
      'MySQL',
      'Redis',
      'BullMQ',
      'IndexedDB (Dexie.js)',
      'MinIO',
    ],
  },
  {
    group: 'DevOps',
    items: ['Docker', 'Nginx', 'Linux', 'GitLab CI/CD', 'GitHub Actions', 'Keycloak', 'Git'],
  },
  { group: 'Testing', items: ['Jest', 'Playwright', 'Automated tests in CI pipelines'] },
]

export const education = [
  {
    title: 'Pearson Higher National Diploma (HND) in Computing',
    place: 'ESOFT University (UG), Colombo, Sri Lanka',
    period: 'June 2025 – Present',
  },
  {
    title: 'ICET Certified Master',
    place: 'Institute of Computer Engineering Technology, Panadura, Sri Lanka',
    period: 'November 2024 – Present (part time)',
  },
  {
    title: 'Diploma in Software Engineering',
    place: 'National Institute of Business Management (NIBM), Colombo, Sri Lanka',
    period: 'June 2023 – December 2024',
  },
]
