# Reader Management Dashboard
## Functional Requirement Document (FRD)

### 1. Project Overview
The Reader Management Dashboard is a centralized web-based platform designed to manage the complete lifecycle of newspaper readers. The system will serve as the single source of truth for all reader-related information, including reader registration, subscription management, newspaper delivery tracking, payment management, organizational hierarchy, and reporting.

The primary objective of the dashboard is to digitize and simplify the operational management of newspaper distribution across multiple cities and centers while providing complete visibility to administrators and authorized operational staff.

The dashboard should be modular, scalable, and capable of managing readers across multiple cities, units, and zones.

---

### 2. Organizational Hierarchy
The dashboard should follow the following hierarchy:

$$\text{Zone} \longrightarrow \text{Unit} \longrightarrow \text{City} \longrightarrow \text{Center} \longrightarrow \text{POC (Area/City POC)} \longrightarrow \text{Reader}$$

#### Hierarchy Explanation
* **Zone:** A Zone consists of multiple Units.
* **Unit:** A Unit consists of multiple Cities.
* **City:** A City consists of one or more Centers.
* **Center:** Each Center contains multiple Readers.
* **POC:** One POC can manage one or more Centers within a city.
* **Reader:** Every Reader must belong to one Center.

This hierarchy will be used throughout the dashboard for permissions, reporting, filtering, and operational management.

---

### 3. Master Data Management
The system should have a Master Data section accessible only by the Administrator. Administrators should be able to create and manage:
* Zones
* Units
* Cities
* Centers
* POCs
* City-wise Newspaper Pricing

All master records should automatically populate dropdown menus throughout the dashboard. For example:
* A Center must first be created before assigning Readers.
* A City must exist before creating Centers.
* POCs can only be assigned to existing Centers.

No free-text entry should be allowed where master data exists. Users should always select values from dropdowns.

---

### 4. Reader Management
The dashboard should maintain a complete profile for every reader. Each reader profile should include:
* Reader ID
* Reader Name
* Mobile Number
* Email Address *(Optional)*
* Complete Address
* Landmark *(Optional)*
* Zone
* Unit
* City
* Center
* Assigned POC
* Subscription Start Date
* Reader Status *(Active/Inactive)*
* Remarks *(Optional)*

Readers can be added individually or through bulk Excel upload.

---

### 5. Bulk Reader Upload
The dashboard should support bulk reader onboarding through Excel.

#### Mandatory Fields
* Reader Name
* Mobile Number
* Complete Address
* City
* Center
* Subscription Start Date

#### Optional Fields
* Email
* Landmark
* Remarks
* Other operational details

During upload, the system should validate:
* Mandatory fields
* Duplicate readers
* Valid mobile numbers
* Existing cities
* Existing centers
* Valid dates

Invalid records should be skipped and reported separately.

---

### 6. Subscription Management
Every reader will have a subscription start date. The subscription start date becomes the basis for:
* Payment calculation
* Billing cycle
* Delivery tracking

The billing cycle will run monthly.

---

### 7. City-wise Newspaper Pricing
Since newspaper pricing may vary from city to city, administrators should configure pricing from the backend. Each City will have its own newspaper price. 

Whenever a reader is added, the system should automatically use the pricing of the assigned city for billing calculations.

---

### 8. Automatic Billing System
The dashboard should automatically calculate reader dues based on:
* Subscription start date
* City-wise newspaper pricing
* Monthly billing cycle
* Actual newspaper delivery attendance

The system should continuously maintain:
* Current Month Charges
* Previous Outstanding
* Total Due
* Total Paid
* Remaining Balance

---

### 9. Delivery Attendance Management
Daily newspaper delivery should be tracked for every reader. Each day should have a delivery status:
* Delivered
* Not Delivered *(Absent)*

Attendance records will directly impact billing.

---

### 10. Bulk Attendance Management
Administrators should be able to mark delivery absence in bulk. Bulk attendance updates should be possible for:
* Individual Reader
* Center
* City
* Unit
* Entire Organization

This allows easy handling of holidays, strikes, operational issues, or non-delivery days. Attendance history should remain available permanently.

---

### 11. Payment Management
The system should maintain complete payment records for every reader. Supported payment methods include:
* Cash
* UPI
* Bank Transfer
* Razorpay *(payment recorded manually after confirmation)*
* Other configurable methods

The dashboard itself does not require direct Razorpay integration. However, authorized users should be able to update payment details whenever a payment is confirmed.

Each payment record should include:
* Payment Date
* Amount
* Payment Method
* Transaction Reference *(Optional)*
* Remarks
* User who updated the payment

After recording payment, the outstanding balance should update automatically.

---

### 12. Coupon & Discount Management
The dashboard should support manual discounts through coupons. Administrators should be able to:
* Create coupons
* Assign coupons to readers
* Apply discount amounts
* Maintain coupon history

#### Example:
* **Outstanding Amount:** ₹500
* **Coupon Applied:** ₹100
* **Final Amount Due:** ₹400

---

### 13. Reader Profile
Every reader profile should provide a complete operational history. The profile should display:

#### Basic Information
* Personal Details
* Contact Information
* Address
* Assigned Location
* Assigned POC
* Subscription Details

#### Payment History
* Complete payment transactions
* Payment dates
* Payment methods
* Outstanding balance
* Coupons applied
* Discounts received

#### Delivery History
* Daily delivery records
* Delivery absent records
* Monthly attendance summary

#### Reader Actions
Authorized users should be able to:
* Edit reader information
* Update delivery records
* Record payments
* Apply coupons
* Send payment reminder SMS
* Transfer reader to another Center or City

---

### 14. Reader Transfer
If a reader shifts location, administrators should be able to transfer the reader to:
* Another Center
* Another City

Historical records including attendance, payment history, coupons, and subscription information should remain unchanged. Only the operational assignment should change.

---

### 15. Reader Directory
The dashboard should provide a searchable list of all readers. Each row should display:
* Reader Name
* Mobile Number
* City
* Center
* POC
* Subscription Start Date
* Outstanding Amount
* Reader Status

---

### 16. Search & Filters
The Reader Directory should support advanced search and filtering.

#### Search By
* Reader Name
* Mobile Number
* Email
* Reader ID

#### Filters
* **Location:** Zone, Unit, City, Center, POC
* **Reader:** Active, Inactive, Newly Added
* **Payments:** Due, No Due, Paid, Outstanding Amount
* **Attendance:** Delivered, Absent
* **Dates:** Reader Added Date, Subscription Start Date, Custom Date Range

Multiple filters should work together.

---

### 17. Payment Transaction View
Apart from reader-wise payment history, the dashboard should also include a centralized payment transaction module. 

This section should display all payment transactions across the system with filters such as:
* Date
* City
* Center
* POC
* Payment Method
* Reader
* Amount

This allows administrators to monitor daily collections and reconcile payments efficiently.

---

### 18. Reports & Dashboard Analytics
The dashboard homepage should provide operational statistics.

#### Suggested KPIs include:
* **Reader Statistics:** Total Readers, Active Readers, Inactive Readers, New Readers, Readers by City, Readers by Center
* **Payment Statistics:** Total Collections, Outstanding Dues, Payments Received Today, Payments Received This Month
* **Delivery Statistics:** Deliveries Completed Today, Delivery Absences Today, Monthly Delivery Percentage

#### Reports
* Reader Report
* Payment Due Report
* Collection Report
* Attendance Report
* City-wise Report
* Center-wise Report
* POC-wise Report
* Monthly Summary

Reports should be filterable and exportable.

---

### 19. Data Export
Only Administrators should be able to export system data. Supported export formats:
* Excel
* CSV

Exportable data includes:
* Reader List
* Payment Records
* Attendance Records
* Outstanding Dues
* Reports

Exports should respect applied filters.

---

### 20. User Roles & Permissions

#### Administrator
Administrator has complete access to the system. Permissions include:
* Manage master data
* Manage readers
* Bulk upload readers
* Update payments
* Update attendance
* Create POCs
* Assign Centers
* Configure pricing
* Create coupons
* Generate reports
* Export data
* View complete nationwide statistics

#### AU POC
AU POC accounts will be created by the Administrator. While creating a POC, the Administrator should assign one or more Centers to that POC. The AU POC should only be able to view and manage readers belonging to the assigned Centers.

**Permissions include:**
* View assigned readers
* Add readers
* Edit reader details
* Update attendance
* Record payments
* View payment history
* Send payment reminder SMS

**Restrictions:**
* Cannot access readers outside assigned Centers.
* Cannot manage master data.
* Cannot export data.
* Cannot view Pan-India statistics.
* Dashboard statistics should be limited to assigned readers and centers only.

---

### 21. Overall System Objective
The Reader Management Dashboard is intended to provide a complete operational platform for newspaper subscription management.

The system should maintain:
* Complete reader information
* Organizational hierarchy
* Subscription lifecycle
* Delivery attendance
* Payment records
* Discount management
* Reader transfer history
* Operational reporting
* Role-based access control

The platform should enable administrators and operational teams to efficiently manage newspaper distribution, monitor collections, track deliveries, and maintain accurate records across all operational levels from Zone to individual Reader.
