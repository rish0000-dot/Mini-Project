export const MOCK_HOSPITALS = [
    { name: 'Krishna Medical Centre', address: 'Dampier Nagar, Mathura', rating: 4.7, distance: '0.8km', tags: ['Emergency', 'Cardiology', 'ICU'] },
    { name: 'Gokul Health Hospital', address: 'Govind Nagar, Mathura', rating: 4.5, distance: '1.2km', tags: ['Neurology', 'Orthopedics', 'Lab'] },
    { name: 'Vrindavan Super Speciality', address: 'Vrindavan Road, Mathura', rating: 4.8, distance: '2.1km', tags: ['Cardiology', 'Oncology', 'ICU'] },
    { name: 'Janaki Maternity Clinic', address: 'Deeg Gate, Mathura', rating: 4.4, distance: '1.7km', tags: ['Pediatrics', 'Maternity', 'NICU'] }
]

export const SERVICE_PRICE_CATALOG = [
    {
        hospital: 'Krishna Medical Centre',
        services: [
            { name: 'ECG', price: 450 },
            { name: 'Cardiology Consultation', price: 900 },
            { name: 'ICU Bed (Per Day)', price: 5200 },
            { name: 'Emergency Care', price: 1500 },
            { name: 'CT Scan', price: 2800 }
        ]
    },
    {
        hospital: 'Gokul Health Hospital',
        services: [
            { name: 'Neurology Consultation', price: 1100 },
            { name: 'Orthopedic Consultation', price: 800 },
            { name: 'Blood Test Panel', price: 700 },
            { name: 'X-Ray', price: 600 },
            { name: 'MRI Scan', price: 4200 }
        ]
    },
    {
        hospital: 'Vrindavan Super Speciality',
        services: [
            { name: 'Oncology Consultation', price: 1300 },
            { name: 'Chemotherapy Session', price: 8500 },
            { name: 'Cardiology Consultation', price: 1000 },
            { name: 'ICU Bed (Per Day)', price: 6400 },
            { name: 'PET Scan', price: 12000 }
        ]
    },
    {
        hospital: 'Janaki Maternity Clinic',
        services: [
            { name: 'Pediatrics Consultation', price: 700 },
            { name: 'Maternity Checkup', price: 1200 },
            { name: 'Normal Delivery Package', price: 28000 },
            { name: 'C-Section Package', price: 52000 },
            { name: 'NICU Bed (Per Day)', price: 4500 }
        ]
    }
]
