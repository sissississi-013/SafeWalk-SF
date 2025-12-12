

# Database Schema

### 7 Tables
 
| Table | Records | Description |
| :--- | :--- | :--- |
| **violent_crimes** | 18,000 | Homicide, Assault, Robbery, Rape, Weapons (2024) |
| **property_crimes** | 13,247 | Burglary, Motor Vehicle Theft (Aug-Dec 2024) |
| **encampments** | 9,582 | 311 Encampment reports (2024) |
| **traffic_injuries** | 8,011 | Crash injuries (2023+) |
| **traffic_fatalities** | 345 | ALL fatalities since 2014 |
| **fire_incidents** | 117 | Incidents with casualties (2020+) |
| **neighborhoods** | 41 | Reference table |
| **incident_categories** | 15 | Severity weights for safety scoring |
| **TOTAL** | **~49,358** | |

---

## 1. violent_crimes (18,000 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `latitude` | REAL | Latitude coordinate |
| `longitude` | REAL | Longitude coordinate |
| `incident_datetime` | TEXT | When incident occurred |
| `incident_category` | TEXT | Homicide, Assault, Robbery, Rape, Weapons |
| `incident_subcategory` | TEXT | Detailed sub-category |
| `incident_description` | TEXT | Full description |
| `resolution` | TEXT | Open/Closed status |
| `analysis_neighborhood` | TEXT | SF neighborhood |
| `police_district` | TEXT | Police district |

---

## 2. property_crimes (13,247 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `latitude` | REAL | Latitude coordinate |
| `longitude` | REAL | Longitude coordinate |
| `incident_datetime` | TEXT | When incident occurred |
| `incident_category` | TEXT | Burglary, Motor Vehicle Theft |
| `incident_subcategory` | TEXT | Detailed sub-category |
| `analysis_neighborhood` | TEXT | SF neighborhood |
| `police_district` | TEXT | Police district |

---

## 3. encampments (9,582 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `latitude` | REAL | Latitude coordinate |
| `longitude` | REAL | Longitude coordinate |
| `requested_datetime` | TEXT | When 311 report filed |
| `service_subtype` | TEXT | Encampment Reports, etc. |
| `address` | TEXT | Street address |
| `analysis_neighborhood` | TEXT | SF neighborhood |
| `police_district` | TEXT | Police district |
| `status_description` | TEXT | Case status |

---

## 4. traffic_fatalities (345 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `latitude` | REAL | Latitude coordinate |
| `longitude` | REAL | Longitude coordinate |
| `collision_datetime` | TEXT | When collision occurred |
| `collision_type` | TEXT | Pedestrian vs MV, etc. |
| `deceased_type` | TEXT | Pedestrian, Driver, Bicyclist |
| `age` | INTEGER | Age of deceased |
| `sex` | TEXT | Sex of deceased |
| `analysis_neighborhood` | TEXT | SF neighborhood |
| `police_district` | TEXT | Police district |

---

## 5. traffic_injuries (8,011 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `latitude` | REAL | Latitude coordinate |
| `longitude` | REAL | Longitude coordinate |
| `collision_datetime` | TEXT | When collision occurred |
| `collision_severity` | TEXT | Complaint of Pain, Other Visible, Severe |
| `type_of_collision` | TEXT | Rear End, Broadside, etc. |
| `number_killed` | INTEGER | Fatalities in crash |
| `number_injured` | INTEGER | Injuries in crash |
| `analysis_neighborhood` | TEXT | SF neighborhood |
| `police_district` | TEXT | Police district |

---

## 6. fire_incidents (117 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `latitude` | REAL | Latitude coordinate |
| `longitude` | REAL | Longitude coordinate |
| `alarm_datetime` | TEXT | When alarm triggered |
| `primary_situation` | TEXT | Fire type/situation code |
| `address` | TEXT | Street address |
| `neighborhood_district` | TEXT | Neighborhood |
| `fire_fatalities` | INTEGER | Firefighter deaths |
| `fire_injuries` | INTEGER | Firefighter injuries |
| `civilian_fatalities` | INTEGER | Civilian deaths |
| `civilian_injuries` | INTEGER | Civilian injuries |

---

## 7. neighborhoods (41 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `name` | TEXT | Neighborhood name |
| `police_district` | TEXT | Associated police district |

---

## 8. incident_categories (15 records)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary key |
| `category` | TEXT | Category name |
| `severity_weight` | INTEGER | Safety score (0-100) |
| `category_type` | TEXT | violent, property, traffic, etc. |