// In-memory mock data layer. Replace with real API calls to the Express/Mongo
// backend described in the project spec — every function below maps 1:1 to a
// future REST endpoint (comments show the suggested route).

export const CATEGORIES = [
  { id: 'skill', name: 'Skill Development', color: '#2C4D90' },
  { id: 'cert', name: 'Technical Certifications', color: '#238F54' },
  { id: 'intern', name: 'Internship', color: '#B8862F' },
  { id: 'project', name: 'Project Work', color: '#7A4FD1' },
  { id: 'research', name: 'Research Activities', color: '#D14F7A' },
  { id: 'sports', name: 'Sports', color: '#208D49' },
  { id: 'cultural', name: 'Cultural Activities', color: '#E0824B' },
  { id: 'community', name: 'Community Service', color: '#3B8FD1' },
]

export const DEPARTMENTS = ['Computer Science', 'BCA', 'Mechanical', 'Commerce', 'Electronics']

// GET /api/tasks
export const TASKS = [
  { id: 't1', name: 'AWS Cloud Practitioner Certification', category: 'cert', description: 'Upload certificate for AWS Cloud Practitioner exam.', maxPoints: 50, maxStarPct: 10, deadline: '2026-07-20', department: 'BCA' },
  { id: 't2', name: 'Summer Internship Report', category: 'intern', description: 'Submit internship completion letter and report.', maxPoints: 80, maxStarPct: 15, deadline: '2026-07-15', department: 'BCA' },
  { id: 't3', name: 'Capstone Project Submission', category: 'project', description: 'Upload final project report and demo link.', maxPoints: 100, maxStarPct: 20, deadline: '2026-08-01', department: 'BCA' },
  { id: 't4', name: 'Inter-College Basketball Tournament', category: 'sports', description: 'Proof of participation / certificate.', maxPoints: 30, maxStarPct: 8, deadline: '2026-07-25', department: 'BCA' },
  { id: 't5', name: 'Blood Donation Camp Volunteering', category: 'community', description: 'Volunteer certificate from camp organizer.', maxPoints: 20, maxStarPct: 5, deadline: '2026-07-10', department: 'BCA' },
  { id: 't6', name: 'Paper Presentation - National Conference', category: 'research', description: 'Upload acceptance letter + paper.', maxPoints: 60, maxStarPct: 12, deadline: '2026-08-10', department: 'BCA' },
]

// GET /api/submissions?studentId=
export const SUBMISSIONS = [
  { id: 's1', taskId: 't1', studentId: 'u1', studentName: 'Aarav Mehta', register: '21BCA045', department: 'BCA', fileName: 'aws_certificate.pdf', status: 'Approved', score: 45, starPct: 9, remarks: 'Valid certificate, well done.', submittedOn: '2026-06-20' },
  { id: 's2', taskId: 't2', studentId: 'u1', studentName: 'Aarav Mehta', register: '21BCA045', department: 'BCA', fileName: 'internship_letter.pdf', status: 'Pending', score: null, starPct: null, remarks: '', submittedOn: '2026-07-01' },
  { id: 's3', taskId: 't5', studentId: 'u1', studentName: 'Aarav Mehta', register: '21BCA045', department: 'BCA', fileName: 'blood_donation.jpg', status: 'Rejected', score: 0, starPct: 0, remarks: 'Certificate illegible, please re-upload.', submittedOn: '2026-06-28' },
  { id: 's4', taskId: 't3', studentId: 'u2', studentName: 'Diya Sharma', register: '21BCA012', department: 'BCA', fileName: 'capstone_report.pdf', status: 'Pending', score: null, starPct: null, remarks: '', submittedOn: '2026-07-02' },
  { id: 's5', taskId: 't4', studentId: 'u3', studentName: 'Rohan Nair', register: '21BCA078', department: 'BCA', fileName: 'basketball_cert.jpg', status: 'Pending', score: null, starPct: null, remarks: '', submittedOn: '2026-07-03' },
  { id: 's6', taskId: 't6', studentId: 'u2', studentName: 'Diya Sharma', register: '21BCA012', department: 'BCA', fileName: 'paper_acceptance.pdf', status: 'Approved', score: 55, starPct: 11, remarks: 'Great work, keep it up.', submittedOn: '2026-06-15' },
]

// GET /api/students/:id/summary
export const CURRENT_STUDENT = {
  id: 'u1',
  name: 'Aarav Mehta',
  register: '21BCA045',
  department: 'BCA',
  totalPoints: 45,
  maxPossiblePoints: 340,
  starPercentage: 34,
}

// GET /api/departments/stats
export const DEPARTMENT_STATS = [
  { department: 'Computer Science', totalPoints: 1200, avgStarPct: 84, students: 96 },
  { department: 'BCA', totalPoints: 1040, avgStarPct: 79, students: 88 },
  { department: 'Mechanical', totalPoints: 980, avgStarPct: 76, students: 102 },
  { department: 'Commerce', totalPoints: 860, avgStarPct: 71, students: 74 },
  { department: 'Electronics', totalPoints: 790, avgStarPct: 68, students: 80 },
]

// GET /api/students/top
export const TOP_STUDENTS = [
  { name: 'Ishaan Verma', department: 'Computer Science', points: 310, starPct: 92 },
  { name: 'Diya Sharma', department: 'BCA', points: 295, starPct: 89 },
  { name: 'Kabir Rao', department: 'Mechanical', points: 280, starPct: 87 },
  { name: 'Ananya Iyer', department: 'Electronics', points: 265, starPct: 84 },
  { name: 'Rohan Nair', department: 'BCA', points: 250, starPct: 81 },
]

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id)
}

export function taskById(id) {
  return TASKS.find((t) => t.id === id)
}
