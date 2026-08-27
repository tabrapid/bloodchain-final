# BloodChain Privacy Documentation

## Overview

The BloodChain handles sensitive health data and is committed to protecting user privacy. This document describes how data is collected, used, stored, and protected.

## Data Classification

### PUBLIC
- Organization names (for public organizations)
- Public campaign information
- Community post content (if made public)

### INTERNAL
- Organization structure
- User roles within organizations
- Appointment availability

### PRIVATE
- User email addresses
- Phone numbers
- Device information
- Session history

### SENSITIVE
- Blood type
- Rh factor
- Health test results
- Medical history
- AI-generated health insights

### HEALTH_SENSITIVE
- Laboratory results
- Blood test values
- Reference ranges
- Donation records

## Data Collection

### Required Data
- Email (for account identification)
- Password (hashed, never stored in plaintext)

### Optional Data
- Phone number
- Date of birth
- Profile photo

### Health Data (Donors)
- Blood type and Rh factor (after verification)
- Blood test results (uploaded by authorized laboratories)
- Health trends (calculated from test results)
- Donation history
- Appointment history
- AI health insights

## Data Use

### Authentication
- Email used for login
- Password hashed with Argon2id

### Health Insights (AI)
The AI system only receives:
- Parameter names and codes
- Test values and dates
- Reference ranges
- Historical values (for trends)

The AI system does NOT receive:
- Full name
- Email address
- Phone number
- Precise location
- Organization information
- Other personal identifiers

### Analytics
- Aggregate platform statistics only
- No individual health records in analytics
- No AI conversation content in analytics

## Data Retention

| Data Type | Retention |
|-----------|-----------|
| User account | Until deleted |
| Health test results | Until deleted by user or admin |
| AI insights | Until deleted by user |
| AI conversations | 90 days, then auto-deleted |
| AI request logs | 90 days |
| AI cache | 24 hours |
| Audit logs | 90 days |
| Sessions | 30 days after expiry |

## Data Access

### User Access
- Donors can access their own health data
- Donors can delete their own data (subject to legal requirements)
- Donors can export their own data

### Organization Access
- Hospital staff see donor data for their patients
- Blood Center staff see donor data for their donors
- Access is limited to operational needs

### Admin Access
- SUPER_ADMIN can access all data for platform management
- Access is logged and audited

## Data Minimization

### AI Health Insights
Only relevant data is sent to the AI:
- Blood tests: parameter, value, date, reference range
- Trends: historical values, change over time
- Chat: user's question and minimal health context

### Location Data
- Precise location only collected for SOS emergencies
- Location shared only with authorized personnel
- Location not stored after emergency resolution

## Third-Party Services

### AI Provider (OpenAI)
- Only health-related text is sent
- No personal identifiers sent
- API key secured server-side

### Map Services
- Location data sent for routing
- No health data shared
- API key secured server-side

### Push Notifications
- Uses Expo/FCM for delivery
- Notification content does not include health details
- Users can disable notifications

## User Rights

### Access
Users can view all data the platform holds about them via:
- Profile page
- Health dashboard
- AI history
- Session management

### Correction
Users can update:
- Profile information
- Notification preferences
- Privacy settings

### Deletion
Users can delete:
- Account (initiates GDPR-compliant deletion)
- AI insights (individual or all)
- AI conversations
- Sessions

Note: Some data may be retained for legal compliance.

## Security Measures

### Encryption
- All data in transit uses TLS
- Passwords hashed with Argon2id
- Refresh tokens use HMAC-SHA256

### Access Control
- Role-based permissions
- Organization-based isolation
- Ownership validation on all resources

### Audit Trail
- All health data access logged
- All administrative actions logged
- Logs retained for 90 days

## Privacy Settings

Users can control:
- Notification preferences (by type)
- Health data sharing preferences
- AI personalization level
- Location sharing for emergencies

## Data Protection Principles

1. **Lawfulness**: Data collected with consent or legitimate interest
2. **Purpose Limitation**: Data used only for stated purposes
3. **Data Minimization**: Only necessary data collected
4. **Accuracy**: Users can correct their data
5. **Storage Limitation**: Data retained only as long as needed
6. **Security**: Appropriate technical measures in place
7. **Accountability**: Privacy practices documented and auditable

## Compliance Notes

The platform is designed with privacy best practices:
- GDPR-inspired data subject rights
- HIPAA-inspired health data protection
-最小データ原則 (Minimum data principle)

Actual compliance certifications depend on deployment and organizational requirements.

## Contact

For privacy-related questions or concerns:
- Data Protection Officer: [configured by organization]
- Privacy inquiries: [privacy@organization.domain]
