const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Activity = require('../models/Activity');
const Submission = require('../models/Submission');
const User = require('../models/User');
const School = require('../models/School');
const Department = require('../models/Department');
const { connectDB } = require('../config/db');

dotenv.config();

const clearCollections = async () => {
  await Promise.all([
    Submission.deleteMany({}),
    User.deleteMany({}),
    Activity.deleteMany({}),
    School.deleteMany({}),
    Department.deleteMany({}),
  ]);
};

const seed = async () => {
  await connectDB();
  await clearCollections();

  const school = await School.create({ name: 'STAR', code: 'STAR', description: 'STAR Knowledge Park' });
  const department = await Department.create({ name: 'Computer Science', schoolId: school._id, code: 'CS' });
  const itDepartment = await Department.create({ name: 'IT', schoolId: school._id, code: 'IT' });

  const dean = await User.create({
    name: 'Dr. Rajesh',
    email: 'rajesh@star.com',
    password: '123456',
    role: 'admin',
    accountType: 'dean',
    schoolId: school._id,
    departmentId: department._id,
    school: school.name,
    department: department.name,
  });

  const hod = await User.create({
    name: 'Dr. Kumar',
    email: 'kumar@star.com',
    password: '123456',
    role: 'admin',
    accountType: 'hod',
    schoolId: school._id,
    departmentId: department._id,
    school: school.name,
    department: department.name,
  });

  const facultyDocs = await Promise.all([
    User.create({ name: 'Priya', email: 'priya@star.com', password: '123456', role: 'faculty', schoolId: school._id, departmentId: department._id, school: school.name, department: department.name, yearAssigned: '2023-2026' }),
    User.create({ name: 'Ravi', email: 'ravi@star.com', password: '123456', role: 'faculty', schoolId: school._id, departmentId: department._id, school: school.name, department: department.name, yearAssigned: '2023-2026' }),
    User.create({ name: 'Sana', email: 'sana@star.com', password: '123456', role: 'faculty', schoolId: school._id, departmentId: department._id, school: school.name, department: department.name, yearAssigned: '2023-2026' }),
  ]);

  await Promise.all([
    User.create({ name: 'Arjun', regNo: '2023BCA001', registerNumber: '2023BCA001', password: '123456', role: 'student', schoolId: school._id, departmentId: department._id, school: school.name, department: department.name, section: 'A', semesterBatch: '2023-2026', year: '2023-2026', assignedFacultyId: facultyDocs[0]._id }),
    User.create({ name: 'Nisha', regNo: '2023BCA002', registerNumber: '2023BCA002', password: '123456', role: 'student', schoolId: school._id, departmentId: department._id, school: school.name, department: department.name, section: 'A', semesterBatch: '2023-2026', year: '2023-2026', assignedFacultyId: facultyDocs[1]._id }),
    User.create({ name: 'Karthik', regNo: '2023BCA003', registerNumber: '2023BCA003', password: '123456', role: 'student', schoolId: school._id, departmentId: department._id, school: school.name, department: department.name, section: 'B', semesterBatch: '2023-2026', year: '2023-2026', assignedFacultyId: facultyDocs[2]._id }),
    User.create({ name: 'Meera', regNo: '2023BCA004', registerNumber: '2023BCA004', password: '123456', role: 'student', schoolId: school._id, departmentId: itDepartment._id, school: school.name, department: itDepartment.name, section: 'A', semesterBatch: '2023-2026', year: '2023-2026', assignedFacultyId: facultyDocs[1]._id }),
  ]);

  const activityCatalog = [
    // ═══════════════════════════════════════════
    // V1 — ACADEMIC PERFORMANCE | Max: 25 SP
    // ═══════════════════════════════════════════
    {
      activityName: 'Semester Exam Percentage',
      vertical: 'V1 — Academic Performance',
      maximumPoints: 5,
      description: 'Upload marksheet showing semester exam percentage',
      levels: [{ label: '< 60%', points: 2 }, { label: '60–69%', points: 3 }, { label: '70–79%', points: 4 }, { label: '80% and above', points: 5 }],
    },
    {
      activityName: 'Attendance Percentage',
      vertical: 'V1 — Academic Performance',
      maximumPoints: 5,
      description: 'Upload attendance record',
      levels: [{ label: '75–79%', points: 2 }, { label: '80–89%', points: 3 }, { label: '90–94%', points: 4 }, { label: '95% and above', points: 5 }],
    },
    {
      activityName: 'Internship / Case Study / Mini Project',
      vertical: 'V1 — Academic Performance',
      maximumPoints: 6,
      description: 'Industry internship, case study, or mini project submission',
      levels: [{ label: 'Case study/Mini project', points: 3 }, { label: 'Industry internship (2 weeks)', points: 4 }, { label: 'Industry internship (4 weeks)', points: 6 }],
    },
    {
      activityName: 'Industrial / Institutional / International Visit',
      vertical: 'V1 — Academic Performance',
      maximumPoints: 10,
      description: 'Industrial, institutional, or international visit proof',
      levels: [{ label: 'Industrial Visit completed', points: 5 }, { label: 'Institutional Visit completed', points: 5 }, { label: 'International Visit / Conference', points: 10 }],
    },
    {
      activityName: 'Library Usage',
      vertical: 'V1 — Academic Performance',
      maximumPoints: 4,
      description: 'Library usage record per semester',
      levels: [{ label: '5 Hrs', points: 2 }, { label: '10 Hrs', points: 3 }, { label: '15 Hrs', points: 4 }],
    },
    {
      activityName: 'Scholarship',
      vertical: 'V1 — Academic Performance',
      maximumPoints: 10,
      description: 'Scholarship application or award proof',
      levels: [{ label: 'Applied for scholarship', points: 3 }, { label: 'Scholarship received', points: 6 }, { label: 'Merit Scholarship', points: 16 }],
    },

    // ═══════════════════════════════════════════
    // V2 — SKILL DEVELOPMENT & CERTIFICATIONS | Min: 15 Max: 30 SP | MANDATORY
    // ═══════════════════════════════════════════
    {
      activityName: 'NPTEL Certification',
      vertical: 'V2 — Skill Development & Certifications',
      maximumPoints: 15,
      description: 'NPTEL course completion certificate',
      levels: [{ label: 'Registered & Completed Assignments', points: 4 }, { label: 'Successfully completed', points: 8 }, { label: 'Elite', points: 12 }, { label: 'Elite with Gold/Silver badge', points: 15 }],
    },
    {
      activityName: 'Online Certification',
      vertical: 'V2 — Skill Development & Certifications',
      maximumPoints: 15,
      description: 'Coursera / Udemy / edX or equivalent certification',
      levels: [{ label: 'Completed 1 course', points: 5 }, { label: 'Specialisation / multi-course', points: 8 }, { label: 'Professional certificate', points: 12 }, { label: '2 professional certs', points: 15 }],
    },
    {
      activityName: 'Industry Certification',
      vertical: 'V2 — Skill Development & Certifications',
      maximumPoints: 20,
      description: 'AWS / Google / Microsoft / Cisco certification',
      levels: [{ label: 'Foundation level', points: 5 }, { label: 'Associate level', points: 10 }, { label: 'Professional level', points: 15 }, { label: 'Expert / Speciality level', points: 20 }],
    },
    {
      activityName: 'Short MOOC / Online Course',
      vertical: 'V2 — Skill Development & Certifications',
      maximumPoints: 5,
      description: 'Short MOOC or online course with assessment',
      levels: [{ label: 'Enrolled & completed', points: 3 }, { label: '2 MOOCs completed', points: 4 }, { label: '3+ MOOCs with assessment', points: 5 }],
    },
    {
      activityName: 'Value Added Course (VAC)',
      vertical: 'V2 — Skill Development & Certifications',
      maximumPoints: 10,
      description: 'VAC with internal or external certification',
      levels: [{ label: 'VAC with assessment / internal certification', points: 5 }, { label: 'External agency / industry expert with certification', points: 10 }],
    },

    // ═══════════════════════════════════════════
    // V3 — CODING & PROBLEM SOLVING | Min: 10 Max: 25 SP | MANDATORY
    // ═══════════════════════════════════════════
    {
      activityName: 'LeetCode / HackerRank / HackerEarth',
      vertical: 'V3 — Coding & Problem Solving',
      maximumPoints: 20,
      description: 'Competitive coding profile with solved problems',
      evidenceType: 'both',
      levels: [{ label: 'Profile + 5–20 Easy', points: 5 }, { label: '50 Easy / 10 Medium', points: 10 }, { label: '50 Medium problems', points: 16 }, { label: '100+ Medium / Hard / Top 10%', points: 20 }],
    },
    {
      activityName: 'Programming, Data Structures & Algorithm',
      vertical: 'V3 — Coding & Problem Solving',
      maximumPoints: 16,
      description: 'Assessment cleared in programming and DSA',
      levels: [{ label: 'Basic assessment cleared', points: 4 }, { label: 'Intermediate cleared', points: 8 }, { label: 'Advanced cleared', points: 12 }, { label: 'Expert / Certification', points: 16 }],
    },
    {
      activityName: 'CodeChef / GeeksforGeeks',
      vertical: 'V3 — Coding & Problem Solving',
      maximumPoints: 20,
      description: 'Star rating or problems solved on CodeChef / GFG',
      evidenceType: 'both',
      levels: [{ label: '1–2 Star / 25 problems', points: 5 }, { label: '3 Star / 50 problems', points: 10 }, { label: '4 Star / 100 problems', points: 15 }, { label: '5 Star / 200 problems', points: 20 }],
    },
    {
      activityName: 'Coding Contest',
      vertical: 'V3 — Coding & Problem Solving',
      maximumPoints: 15,
      description: 'College or online coding contest participation / win',
      levels: [{ label: 'Participated', points: 3 }, { label: 'Top 50%', points: 6 }, { label: 'Finalist', points: 10 }, { label: 'Winner', points: 15 }],
    },
    {
      activityName: 'Open-Source Contribution',
      vertical: 'V3 — Coding & Problem Solving',
      maximumPoints: 5,
      description: 'GitHub pull request or open-source contribution',
      levels: [{ label: 'GitHub profile + starred/forked repo + raised an issue', points: 3 }, { label: 'Pull Request submitted', points: 5 }],
    },

    // ═══════════════════════════════════════════
    // V4 — INNOVATION, HACKATHONS & ENTREPRENEURSHIP | Min: 10 Max: 20 SP | MANDATORY
    // ═══════════════════════════════════════════
    {
      activityName: 'Hackathon / Datathon',
      vertical: 'V4 — Innovation, Hackathons & Entrepreneurship',
      maximumPoints: 20,
      description: 'Hackathon or datathon participation / win',
      levels: [{ label: 'Participated', points: 5 }, { label: 'Qualified round / finalist', points: 10 }, { label: 'Regional/Local winner', points: 15 }, { label: 'IIT/NIT /National winner', points: 20 }],
    },
    {
      activityName: 'Ideathon / Business Plan Competition',
      vertical: 'V4 — Innovation, Hackathons & Entrepreneurship',
      maximumPoints: 16,
      description: 'Ideathon or business plan competition',
      levels: [{ label: 'Participated', points: 4 }, { label: 'Shortlisted / top 50%', points: 8 }, { label: 'Finalist', points: 12 }, { label: 'Winner', points: 16 }],
    },
    {
      activityName: 'Startup / Entrepreneurship / Innovation Challenge',
      vertical: 'V4 — Innovation, Hackathons & Entrepreneurship',
      maximumPoints: 20,
      description: 'Startup idea, prototype, or incubation proof',
      levels: [{ label: 'Participated / idea submitted', points: 5 }, { label: 'Prototype / MVP built', points: 10 }, { label: 'Incubated', points: 15 }, { label: 'Startup registered / funded', points: 20 }],
    },
    {
      activityName: 'Technical Event (quiz / GD / Debugging / others)',
      vertical: 'V4 — Innovation, Hackathons & Entrepreneurship',
      maximumPoints: 15,
      description: 'Technical quiz, GD, debugging, or similar event',
      levels: [{ label: 'Intra-college participation', points: 3 }, { label: 'Intra-college winner / Inter-college participation', points: 6 }, { label: 'Inter-college winner', points: 10 }, { label: 'State/national winner', points: 15 }],
    },

    // ═══════════════════════════════════════════
    // V5 — RESEARCH, PUBLICATIONS & IPR | Max: 20 SP
    // ═══════════════════════════════════════════
    {
      activityName: 'Paper Presentation',
      vertical: 'V5 — Research, Publications & IPR',
      maximumPoints: 20,
      description: 'Paper presented at internal, state, or international level',
      levels: [{ label: 'Internal / Department', points: 5 }, { label: 'External/Intercollegiate', points: 10 }, { label: 'State / National level', points: 15 }, { label: 'International', points: 20 }],
    },
    {
      activityName: 'Conference / Journal Publication',
      vertical: 'V5 — Research, Publications & IPR',
      maximumPoints: 20,
      description: 'Conference paper or journal publication proof',
      levels: [{ label: 'Abstract submitted', points: 5 }, { label: 'Conference paper published', points: 10 }, { label: 'Indexed conference', points: 15 }, { label: 'Indexed journal (Scopus)', points: 20 }],
    },
    {
      activityName: 'Patent / Copyright / Trademark',
      vertical: 'V5 — Research, Publications & IPR',
      maximumPoints: 25,
      description: 'Patent draft, publication, or grant certificate',
      levels: [{ label: 'Draft filed', points: 10 }, { label: 'Published', points: 15 }, { label: 'Granted', points: 20 }, { label: 'Copyright', points: 25 }],
    },
    {
      activityName: 'Book Chapter / Project Report',
      vertical: 'V5 — Research, Publications & IPR',
      maximumPoints: 20,
      description: 'Book chapter or project report submission',
      levels: [{ label: 'Internal project report', points: 5 }, { label: 'Book chapter submitted', points: 10 }, { label: 'Book chapter published', points: 15 }, { label: 'International publisher', points: 20 }],
    },
    {
      activityName: 'Workshop / Symposium / Conference / Seminar Attended',
      vertical: 'V5 — Research, Publications & IPR',
      maximumPoints: 12,
      description: 'Workshop, symposium, or conference attendance proof',
      levels: [{ label: '1 event attended', points: 3 }, { label: '2 events attended', points: 5 }, { label: '3+ events / paper presented', points: 8 }, { label: 'Best paper / award', points: 12 }],
    },

    // ═══════════════════════════════════════════
    // V6 — DOMAIN / INTER-DISCIPLINARY PROJECTS | Min: 10 Max: 20 SP | MANDATORY
    // ═══════════════════════════════════════════
    {
      activityName: 'Kaggle / Analytics Vidhya / GitHub',
      vertical: 'V6 — Domain / Inter-Disciplinary Projects',
      maximumPoints: 20,
      description: 'Kaggle, Analytics Vidhya, or GitHub profile with projects',
      levels: [{ label: 'Profile created + participated', points: 5 }, { label: 'Top 50%', points: 10 }, { label: 'Bronze / top 25%', points: 15 }, { label: 'Silver/Gold / top 10%', points: 20 }],
    },
    {
      activityName: 'AI / ML / DS / Web Dev / Networking Project',
      vertical: 'V6 — Domain / Inter-Disciplinary Projects',
      maximumPoints: 20,
      description: 'Domain project from prototype to deployed stage',
      levels: [{ label: 'Prototype / idea stage', points: 5 }, { label: 'Functional project', points: 10 }, { label: 'Deployed (app / dashboard)', points: 15 }, { label: 'Real user adoption / published', points: 20 }],
    },
    {
      activityName: 'Live Project',
      vertical: 'V6 — Domain / Inter-Disciplinary Projects',
      maximumPoints: 20,
      description: 'Live deployed project with URL proof',
      levels: [{ label: 'Basic deployment', points: 5 }, { label: 'Multi-service deployment', points: 10 }, { label: 'Production-ready', points: 15 }, { label: 'Certified + deployed', points: 20 }],
    },
    {
      activityName: 'GenAI / Prompt Engineering Application',
      vertical: 'V6 — Domain / Inter-Disciplinary Projects',
      maximumPoints: 20,
      description: 'GenAI or prompt engineering project',
      levels: [{ label: 'Used AI tools + documented', points: 5 }, { label: 'Built GenAI-integrated project', points: 10 }, { label: 'Deployed GenAI app', points: 15 }, { label: 'Industry / research recognised', points: 20 }],
    },

    // ═══════════════════════════════════════════
    // V7 — PROFESSIONAL BRANDING & NETWORKING | Min: 10 Max: 15 SP | MANDATORY
    // ═══════════════════════════════════════════
    {
      activityName: 'LinkedIn Profile',
      vertical: 'V7 — Professional Branding & Networking',
      maximumPoints: 15,
      description: 'LinkedIn profile with connections and posts',
      levels: [{ label: 'Profile created (Professional)', points: 3 }, { label: '50 connections + active posts + tagging college, Principal, Dean & HOD', points: 6 }, { label: '100 connections + weekly posts + engagement (likes/comments)', points: 10 }, { label: 'Recommendations + thought leader + college/department featured/shared your post', points: 15 }],
    },
    {
      activityName: 'GitHub Portfolio',
      vertical: 'V7 — Professional Branding & Networking',
      maximumPoints: 15,
      description: 'GitHub portfolio with repositories',
      levels: [{ label: 'Account + 2–5 repos', points: 3 }, { label: '5–10 repos with README', points: 6 }, { label: 'Practical work submission', points: 10 }, { label: 'Mini-projects / projects submission', points: 15 }],
    },
    {
      activityName: 'Portfolio Website',
      vertical: 'V7 — Professional Branding & Networking',
      maximumPoints: 15,
      description: 'Personal portfolio website with deployed projects',
      levels: [{ label: 'Basic portfolio page', points: 5 }, { label: 'Professional with projects', points: 10 }, { label: 'Project showcase + deployed', points: 15 }],
    },
    {
      activityName: 'Technical Blog / Podcast / Video',
      vertical: 'V7 — Professional Branding & Networking',
      maximumPoints: 15,
      description: 'Technical blog, podcast, or YouTube channel',
      levels: [{ label: '3 blogs / 3 videos', points: 4 }, { label: '5 blogs', points: 8 }, { label: '10 blogs / YouTube channel', points: 12 }, { label: 'Industry / media recognition', points: 15 }],
    },

    // ═══════════════════════════════════════════
    // V8 — LEADERSHIP AND GOVERNANCE | Min: 10 Max: 20 SP | Mandatory
    // ═══════════════════════════════════════════
    {
      activityName: 'Peer Mentoring / Knowledge Sharing',
      vertical: 'V8 — Leadership and Governance',
      maximumPoints: 10,
      description: 'Peer mentoring or knowledge sharing session',
      levels: [{ label: 'Helped 1–2 students', points: 3 }, { label: 'Study group / 5 students', points: 5 }, { label: 'Workshop / session conducted (class / juniors)', points: 7 }, { label: 'Structured mentoring programme', points: 10 }],
    },
    {
      activityName: 'Student Council / Club / Association',
      vertical: 'V8 — Leadership and Governance',
      maximumPoints: 15,
      description: 'Student council, club, or professional association role',
      levels: [{ label: 'Member', points: 5 }, { label: 'Active contributor', points: 8 }, { label: 'Coordinator / Jt. Secretary', points: 12 }, { label: 'President / Secretary', points: 15 }],
    },
    {
      activityName: 'Professional Conduct & Discipline',
      vertical: 'V8 — Leadership and Governance',
      maximumPoints: 5,
      description: 'Awarded by mentor for professional conduct',
      levels: [{ label: 'Awarded by Mentor', points: 5 }],
    },
    {
      activityName: 'Event Organising Committee',
      vertical: 'V8 — Leadership and Governance',
      maximumPoints: 15,
      description: 'Event organising committee role proof',
      levels: [{ label: 'Volunteer in a department-level event', points: 3 }, { label: 'Core committee member in college-level event', points: 8 }, { label: 'Coordinator / Joint Secretary of major college event', points: 12 }, { label: 'Chief Organiser / Convenor of inter-college / national event', points: 15 }],
    },

    // ═══════════════════════════════════════════
    // V9 — SPORTS, NSS, NCC, CULTURAL & COMMUNITY ENGAGEMENT | Max: 15 SP
    // ═══════════════════════════════════════════
    {
      activityName: 'NSS',
      vertical: 'V9 — Sports, NSS, NCC, Cultural & Community Engagement',
      maximumPoints: 15,
      description: 'NSS enrollment, volunteering, or camp leadership',
      levels: [{ label: 'Enrolled', points: 5 }, { label: 'Active volunteer', points: 8 }, { label: 'Event organiser / camp', points: 12 }, { label: 'Camp leader / award', points: 15 }],
    },
    {
      activityName: 'NCC',
      vertical: 'V9 — Sports, NSS, NCC, Cultural & Community Engagement',
      maximumPoints: 15,
      description: 'NCC enrollment or certificate',
      levels: [{ label: 'Enrolled', points: 5 }, { label: 'Certificate A/B', points: 10 }, { label: 'Certificate C', points: 14 }, { label: 'Leadership / National', points: 15 }],
    },
    {
      activityName: 'Cultural Events',
      vertical: 'V9 — Sports, NSS, NCC, Cultural & Community Engagement',
      maximumPoints: 15,
      description: 'Music, dance, drama, or fine arts participation / win',
      levels: [{ label: 'College-level participation', points: 5 }, { label: 'Intercollegiate participation', points: 8 }, { label: 'Intercollegiate winner', points: 12 }, { label: 'State / national level', points: 15 }],
    },
    {
      activityName: 'Sports',
      vertical: 'V9 — Sports, NSS, NCC, Cultural & Community Engagement',
      maximumPoints: 15,
      description: 'Sports participation or win at college / state level',
      levels: [{ label: 'College-level participation', points: 5 }, { label: 'Intercollegiate participation', points: 8 }, { label: 'Intercollegiate winner', points: 12 }, { label: 'State / national level', points: 15 }],
    },
    {
      activityName: 'Community Outreach / Social Initiative',
      vertical: 'V9 — Sports, NSS, NCC, Cultural & Community Engagement',
      maximumPoints: 15,
      description: 'NGO, social initiative, or community outreach activity',
      levels: [{ label: 'Participated in 1 activity', points: 4 }, { label: 'Active volunteer (3+ events)', points: 8 }, { label: 'Coordinator / project lead', points: 12 }, { label: 'Measurable social impact', points: 15 }],
    },
    {
      activityName: 'Air-Rifle Academy',
      vertical: 'V9 — Sports, NSS, NCC, Cultural & Community Engagement',
      maximumPoints: 15,
      description: 'Air-rifle academy enrollment or achievement',
      levels: [{ label: 'Enrolled', points: 5 }, { label: 'District level', points: 8 }, { label: 'State level', points: 12 }, { label: 'National level', points: 15 }],
    },

    // ═══════════════════════════════════════════
    // V10 — PLACEMENT READINESS & EXTRA CREDITS | Min: 5 Max: 10 SP | MANDATORY
    // ═══════════════════════════════════════════
    {
      activityName: 'Resume Building',
      vertical: 'V10 — Placement Readiness & Extra Credits',
      maximumPoints: 10,
      description: 'Resume draft, review, or ATS-optimised version',
      levels: [{ label: 'Basic draft created', points: 3 }, { label: 'Senior reviewed', points: 5 }, { label: 'ATS-optimised', points: 7 }, { label: 'Industry-reviewed / LinkedIn synced', points: 10 }],
    },
    {
      activityName: 'Mock Interview / GD / Aptitude Test',
      vertical: 'V10 — Placement Readiness & Extra Credits',
      maximumPoints: 10,
      description: 'Mock interview, GD, or aptitude test performance',
      levels: [{ label: 'Attended mock / aptitude', points: 3 }, { label: 'Cleared aptitude test (>=60%)', points: 5 }, { label: 'High rating mock interview', points: 7 }, { label: 'Outstanding / top performer', points: 10 }],
    },
    {
      activityName: 'Placement / Internship Offer',
      vertical: 'V10 — Placement Readiness & Extra Credits',
      maximumPoints: 10,
      description: 'Internship or placement offer letter',
      levels: [{ label: 'Internship offer received', points: 3 }, { label: 'Placement offer (<5 LPA)', points: 5 }, { label: 'Placement offer (5-10 LPA)', points: 8 }, { label: 'Dream offer (>10 LPA)', points: 10 }],
    },
    {
      activityName: 'Higher Studies / Competitive Exam',
      vertical: 'V10 — Placement Readiness & Extra Credits',
      maximumPoints: 10,
      description: 'GATE / GRE / CAT / NET exam result or admission proof',
      levels: [{ label: 'Appeared in exam', points: 3 }, { label: 'Qualified / cleared', points: 6 }, { label: 'Good percentile (>=70%ile)', points: 8 }, { label: 'Top rank / scholarship / admission', points: 10 }],
    },
  ];
  await Activity.insertMany(activityCatalog);

  console.log('Seed data inserted for school, departments, admin, faculty, students, and activities');
  await mongoose.disconnect();
};

if (require.main === module) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { activityCatalog: undefined };