import { buildCollection, buildProperty } from "@firecms/core";

export const seniorsCollection = buildCollection({
    id: "senior_records", // Unique ID to avoid "users" collision/caching
    name: "Seniors",
    group: "User Management",
    path: "users",
    icon: "Elderly",
    description: "Manage senior profiles",
    initialFilter: {
        role: ["==", "senior"]
    },
    permissions: {
        edit: true,
        create: true,
        delete: true
    },
    properties: {
        name: buildProperty({
            name: "Name",
            dataType: "string"
        }),
        fullName: buildProperty({
            name: "Full Name",
            dataType: "string"
        }),
        phone: buildProperty({
            name: "Phone Number",
            dataType: "string",
            validation: {
                required: true,
                matches: /^\+91\d{10}$/,
                matchesMessage: "Please enter a valid Indian mobile number (e.g., +919876543210)"
            }
        }),
        role: buildProperty({
            name: "Role",
            dataType: "string",
            enumValues: {
                senior: "Senior"
            },
            defaultValue: "senior",
            validation: { required: true },
            disabled: true // Prevent changing role accidentally
        }),
        age: buildProperty({
            name: "Age",
            dataType: "number"
        }),
        gender: buildProperty({
            name: "Gender",
            dataType: "string",
            enumValues: {
                male: "Male",
                female: "Female",
                other: "Other"
            }
        }),
        language: buildProperty({
            name: "Language",
            dataType: "string"
        }),
        preferredLanguage: buildProperty({
            name: "Preferred Language",
            dataType: "string"
        }),
        linkingCode: buildProperty({
            name: "Linking Code",
            dataType: "string",
            disabled: true
        }),
        careManagerId: buildProperty({
            name: "Assigned Care Manager",
            dataType: "string",
            // In a real app, this could be a reference, but for now string ID is fine
        }),
        addressLine1: buildProperty({
            name: "Address Line 1",
            dataType: "string"
        }),
        addressArea: buildProperty({
            name: "Area",
            dataType: "string"
        }),
        addressCity: buildProperty({
            name: "City",
            dataType: "string"
        }),
        addressState: buildProperty({
            name: "State",
            dataType: "string"
        }),
        addressPincode: buildProperty({
            name: "Pincode",
            dataType: "string"
        }),
        employmentStatus: buildProperty({
            name: "Employment Status",
            dataType: "string"
        }),
        livingStatus: buildProperty({
            name: "Living Status",
            dataType: "string"
        }),
        status: buildProperty({
            name: "Account Status",
            dataType: "string",
            enumValues: {
                active: "Active",
                inactive: "Inactive"
            },
            defaultValue: "active"
        }),
        createdAt: buildProperty({
            name: "Created At",
            dataType: "date",
            autoValue: "on_create"
        })
    }
});
