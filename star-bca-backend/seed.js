const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { connectDB, Student, Faculty, HOD, Dean } = require('./src/config/db');

const ensureCollectionDropped = async (collectionName) => {
  try {
    await mongoose.connection.db.dropCollection(collectionName);
    console.log(`Dropped collection: ${collectionName}`);
  } catch (error) {
    if (error.codeName === 'NamespaceNotFound') {
      console.log(`Collection not found, skipping drop: ${collectionName}`);
      return;
    }
    throw error;
  }
};

const seed = async () => {
  try {
    await connectDB();

    await ensureCollectionDropped('users');
    await Promise.all([
      Student.deleteMany({}),
      Faculty.deleteMany({}),
      HOD.deleteMany({}),
      Dean.deleteMany({})
    ]);

    const deanData = [
      {
        name: 'Dr. Rajesh',
        email: 'rajesh@star.com',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR'
      },
      {
        name: 'Dr. Meena',
        email: 'meena@star.com',
        password: '123456',
        department: 'IT',
        school: 'STAR'
      }
    ];

    const createdDeans = [];
    for (const dean of deanData) {
      createdDeans.push(await new Dean(dean).save());
    }

    const hodData = [
      {
        name: 'Dr. Kumar',
        email: 'kumar@star.com',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR',
        recommendedDean: createdDeans[0]._id
      },
      {
        name: 'Dr. Suresh',
        email: 'suresh@star.com',
        password: '123456',
        department: 'IT',
        school: 'STAR',
        recommendedDean: createdDeans[1]._id
      }
    ];

    const createdHods = [];
    for (const hod of hodData) {
      createdHods.push(await new HOD(hod).save());
    }

    const facultyData = [
      {
        name: 'Priya',
        email: 'priya@star.com',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR',
        recommendHOD: createdHods[0]._id,
        recommendDean: createdDeans[0]._id
      },
      {
        name: 'Ravi',
        email: 'ravi@star.com',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR',
        recommendHOD: createdHods[0]._id,
        recommendDean: createdDeans[0]._id
      },
      {
        name: 'Sana',
        email: 'sana@star.com',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR',
        recommendHOD: createdHods[0]._id,
        recommendDean: createdDeans[0]._id
      }
    ];

    const createdFaculties = [];
    for (const faculty of facultyData) {
      createdFaculties.push(await new Faculty(faculty).save());
    }

    const studentData = [
      {
        name: 'Arjun',
        regNo: '2023BCA001',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR',
        section: 'A',
        semesterBatch: '2023-2026',
        recommendedFaculty: createdFaculties[0]._id,
        recommendedHOD: createdHods[0]._id,
        recommendedDean: createdDeans[0]._id,
        points: 0,
        surplusPoints: 0,
        attachments: []
      },
      {
        name: 'Nisha',
        regNo: '2023BCA002',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR',
        section: 'A',
        semesterBatch: '2023-2026',
        recommendedFaculty: createdFaculties[1]._id,
        recommendedHOD: createdHods[0]._id,
        recommendedDean: createdDeans[0]._id,
        points: 0,
        surplusPoints: 0,
        attachments: []
      },
      {
        name: 'Karthik',
        regNo: '2023BCA003',
        password: '123456',
        department: 'Computer Science',
        school: 'STAR',
        section: 'B',
        semesterBatch: '2023-2026',
        recommendedFaculty: createdFaculties[2]._id,
        recommendedHOD: createdHods[0]._id,
        recommendedDean: createdDeans[0]._id,
        points: 0,
        surplusPoints: 0,
        attachments: []
      },
      {
        name: 'Meera',
        regNo: '2023BCA004',
        password: '123456',
        department: 'IT',
        school: 'STAR',
        section: 'A',
        semesterBatch: '2023-2026',
        recommendedFaculty: createdFaculties[1]._id,
        recommendedHOD: createdHods[1]._id,
        recommendedDean: createdDeans[1]._id,
        points: 5,
        surplusPoints: 1,
        attachments: []
      }
    ];

    for (const student of studentData) {
      await new Student(student).save();
    }

    console.log('Seed completed successfully.');
    console.log('Created deans, hods, faculties, and students.');
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seed();
