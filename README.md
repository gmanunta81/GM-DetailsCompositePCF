DetailComposite PCF Control - Documentation
Copy the content below as a README.md file for your repository:
---
# DetailComposite PCF Control

A Power Apps Component Framework (PCF) control that dynamically composes text from Dataverse entity fields and saves it to a target field. Supports reading from the same entity or related entities via lookups.

## Features

- ✅ Read fields from current entity or related entities
- ✅ Support for lookup relationships (N:1 and 1:N)
- ✅ Template-based output with `{{fieldname}}` placeholders
- ✅ Automatic formatting for OptionSets, Lookups, Currency, and DateTime
- ✅ Environment Variable support for centralized configuration
- ✅ Auto-save functionality
- ✅ Refresh button for manual recalculation
- ✅ Copy to clipboard functionality

## Installation

1. Build the solution: npm install npm run build
2. Package the solution: msbuild /t:build /restore

3. 
3. Import the solution into your Power Platform environment.

4. Add the control to a text field on your entity form.

---

## Configuration Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `source` | string | No | Current entity | Source entity logical name |
| `lookupfield` | string | Conditional | - | Lookup field on target pointing to source |
| `sourcefield` | string | Conditional | - | Field on source pointing to target |
| `separator` | string | No | `\n` | Separator between rows |
| `truncateWith` | string | No | `...` | Truncation indicator |
| `top` | number | No | `1` | Max records (for sourcefield) |
| `orderBy` | string | No | - | OData order expression |
| `rows` | array | Yes* | - | Array of field definitions |
| `formattedoutput` | string | No | - | Template with `{{fieldname}}` |
| `autoSave` | boolean | No | `true` | Auto-save after computation |
| `EnvironmentJson` | string | No | - | Environment variable schema name |

---

## Relationship Scenarios

### Scenario 1: Same Entity
Control reads from the same entity where it's placed. No `lookupfield` or `sourcefield` needed.

### Scenario 2: Target → Source (using lookupfield)
Target entity has a lookup to source entity.
Example: Contact.parentcustomerid → Account

### Scenario 3: Source → Target (using sourcefield)
Source entity has a field pointing to target entity.
Example: Contact._parentcustomerid_value → Account

---

## JSON Examples

### Example 1: Same Entity (Basic)

**Scenario**: Control on Account form, reading Account fields.
{ "separator": "\n", "truncateWith": "...", "rows": [ [{ "fieldname": "name", "displayname": "🏢 ", "suffix": "" }], [{ "fieldname": "telephone1", "displayname": "📞 ", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "✉️ ", "suffix": "" }] ], "autoSave": true }

---

### Example 2: Same Entity with Template

**Scenario**: Control on Account form with template output.
{ "rows": [ [{ "fieldname": "name", "displayname": "", "suffix": "" }], [{ "fieldname": "telephone1", "displayname": "Tel: ", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "Email: ", "suffix": "" }] ], "formattedoutput": "Company: {{name}} | {{telephone1}} | {{emailaddress1}}", "autoSave": true }

**Output**:
Company: Contoso Ltd | Tel: +1 234 567 890 | Email: info@contoso.com



---

### Example 3: Full Address Composition

**Scenario**: Control on Account form, composing full address.
{ "separator": "\n", "rows": [ [{ "fieldname": "name", "displayname": "🏢 ", "suffix": "" }], [{ "fieldname": "address1_line1", "displayname": "📍 ", "suffix": "" }], [ { "fieldname": "address1_city", "displayname": "", "suffix": "" }, { "fieldname": "address1_stateorprovince", "displayname": ", ", "suffix": "" }, { "fieldname": "address1_postalcode", "displayname": " ", "suffix": "" } ], [{ "fieldname": "address1_country", "displayname": "", "suffix": "" }], [{ "fieldname": "telephone1", "displayname": "📞 ", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "✉️ ", "suffix": "" }], [{ "fieldname": "websiteurl", "displayname": "🌐 ", "suffix": "" }] ], "autoSave": true }


**Output**:
🏢 Contoso Ltd 📍 123 Main Street New York, NY 10001 United States 📞 +1 234 567 890 ✉️ info@contoso.com 🌐 https://www.contoso.com


---

### Example 4: Contact → Account (Target → Source)

**Scenario**: Control on Contact form, reading related Account data.
{ "source": "account", "lookupfield": "_parentcustomerid_value", "separator": "\n", "rows": [ [{ "fieldname": "name", "displayname": "🏢 ", "suffix": "" }], [ { "fieldname": "address1_line1", "displayname": "📍 ", "suffix": "" }, { "fieldname": "address1_city", "displayname": ", ", "suffix": "" }, { "fieldname": "address1_postalcode", "displayname": " ", "suffix": "" } ], [{ "fieldname": "telephone1", "displayname": "📞 ", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "✉️ ", "suffix": "" }], [{ "fieldname": "websiteurl", "displayname": "🌐 ", "suffix": "" }] ], "formattedoutput": "🏢 {{name}}\n📍 {{address1_line1}}, {{address1_city}} {{address1_postalcode}}\n📞 {{telephone1}}\n✉️ {{emailaddress1}}\n🌐 {{websiteurl}}", "autoSave": true }


**Relationship**: `Contact.parentcustomerid → Account.accountid`

---

### Example 5: Opportunity → Account

**Scenario**: Control on Opportunity form, reading related Account data.
{ "source": "account", "lookupfield": "_parentcustomerid_value", "separator": "\n", "rows": [ [{ "fieldname": "name", "displayname": "🏢 ", "suffix": "" }], [ { "fieldname": "address1_line1", "displayname": "📍 ", "suffix": "" }, { "fieldname": "address1_city", "displayname": ", ", "suffix": "" }, { "fieldname": "address1_postalcode", "displayname": " ", "suffix": "" } ], [{ "fieldname": "telephone1", "displayname": "📞 ", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "✉️ ", "suffix": "" }], [{ "fieldname": "websiteurl", "displayname": "🌐 ", "suffix": "" }] ], "formattedoutput": "🏢 {{name}}\n📍 {{address1_line1}}, {{address1_city}} {{address1_postalcode}}\n📞 {{telephone1}}\n✉️ {{emailaddress1}}\n🌐 {{websiteurl}}", "autoSave": true }


**Relationship**: `Contact.parentcustomerid → Account.accountid`

---

### Example 5: Opportunity → Account

**Scenario**: Control on Opportunity form, reading related Account data.
{ "source": "account", "lookupfield": "_parentaccountid_value", "separator": "\n", "rows": [ [{ "fieldname": "name", "displayname": "🏢 Account: ", "suffix": "" }], [{ "fieldname": "industrycode", "displayname": "🏭 Industry: ", "suffix": "" }], [{ "fieldname": "revenue", "displayname": "💰 Revenue: ", "suffix": "" }], [{ "fieldname": "numberofemployees", "displayname": "👥 Employees: ", "suffix": "" }] ], "autoSave": true }


**Relationship**: `Opportunity.parentaccountid → Account.accountid`

---

### Example 6: Account → Primary Contact (Source → Target)

**Scenario**: Control on Account form, reading related Contact data.
{ "source": "contact", "sourcefield": "_parentcustomerid_value", "separator": "\n", "top": 1, "orderBy": "createdon desc", "rows": [ [{ "fieldname": "fullname", "displayname": "👤 ", "suffix": "" }], [{ "fieldname": "jobtitle", "displayname": "💼 ", "suffix": "" }], [{ "fieldname": "telephone1", "displayname": "📞 ", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "✉️ ", "suffix": "" }], [{ "fieldname": "mobilephone", "displayname": "📱 ", "suffix": "" }] ], "autoSave": true }



**Relationship**: `Contact._parentcustomerid_value = Account.accountid`

**Output**: 👤 John Smith 💼 Sales Manager 📞 +1 234 567 890 ✉️ john.smith@contoso.com 📱 +1 234 567 891


---

### Example 7: Account → Latest Case

**Scenario**: Control on Account form, reading latest related Case.
{ "source": "incident", "sourcefield": "_customerid_value", "separator": "\n", "top": 1, "orderBy": "createdon desc", "rows": [ [{ "fieldname": "title", "displayname": "🎫 Case: ", "suffix": "" }], [{ "fieldname": "ticketnumber", "displayname": "# ", "suffix": "" }], [{ "fieldname": "prioritycode", "displayname": "⚡ Priority: ", "suffix": "" }], [{ "fieldname": "statuscode", "displayname": "📊 Status: ", "suffix": "" }], [{ "fieldname": "createdon", "displayname": "📅 Created: ", "suffix": "" }] ], "autoSave": true }


---

### Example 8: Using Environment Variable

**JSON in PCF configJson property**:

{ "EnvironmentJson": "gm_detailcomposite_account_config" }

**JSON in Environment Variable** (`gm_detailcomposite_account_config`):
{ "separator": "\n", "rows": [ [{ "fieldname": "name", "displayname": "🏢 ", "suffix": "" }], [{ "fieldname": "telephone1", "displayname": "📞 ", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "✉️ ", "suffix": "" }] ], "autoSave": true }


---

### Example 9: Compact Contact Card

**Scenario**: Multiple fields per line for compact display.
{ "separator": "\n", "rows": [ [ { "fieldname": "firstname", "displayname": "", "suffix": " " }, { "fieldname": "lastname", "displayname": "", "suffix": "" } ], [ { "fieldname": "jobtitle", "displayname": "", "suffix": " at " }, { "fieldname": "parentcustomerid", "displayname": "", "suffix": "" } ], [ { "fieldname": "telephone1", "displayname": "📞 ", "suffix": " | " }, { "fieldname": "mobilephone", "displayname": "📱 ", "suffix": "" } ], [{ "fieldname": "emailaddress1", "displayname": "✉️ ", "suffix": "" }] ], "autoSave": true }


**Output**: John Smith Sales Manager at Contoso Ltd 📞 +1 234 567 890 | 📱 +1 234 567 891 ✉️ john.smith@contoso.com


---

### Example 10: Single Line Output

**Scenario**: Simple inline display with pipe separator.
{ "separator": " | ", "rows": [ [{ "fieldname": "name", "displayname": "", "suffix": "" }], [{ "fieldname": "telephone1", "displayname": "", "suffix": "" }], [{ "fieldname": "emailaddress1", "displayname": "", "suffix": "" }] ] }


**Output**: Contoso Ltd | +1 234 567 890 | info@contoso.com
{ "separator": "\n", "rows": [ [{ "fieldname": "name", "displayname": "🏢 ", "suffix": "" }], [{ "fieldname": "industrycode", "displayname": "🏭 Industry: ", "suffix": "" }], [{ "fieldname": "revenue", "displayname": "💰 Annual Revenue: ", "suffix": "" }], [{ "fieldname": "numberofemployees", "displayname": "👥 Employees: ", "suffix": "" }], [{ "fieldname": "ownerid", "displayname": "👤 Owner: ", "suffix": "" }] ], "autoSave": true }


---

### Example 12: Disable Auto-Save

**Scenario**: Compute value without auto-saving.
{ "rows": [ [{ "fieldname": "name", "displayname": "", "suffix": "" }] ], "autoSave": false }



---

## Common Lookup Fields Reference

| Entity | Lookup Field | Points To |
|--------|--------------|-----------|
| Contact | `_parentcustomerid_value` | Account |
| Opportunity | `_parentaccountid_value` | Account |
| Opportunity | `_parentcontactid_value` | Contact |
| Case | `_customerid_value` | Account/Contact |
| Case | `_primarycontactid_value` | Contact |
| Activity | `_regardingobjectid_value` | Various |
| Quote | `_customerid_value` | Account/Contact |
| Order | `_customerid_value` | Account/Contact |
| Invoice | `_customerid_value` | Account/Contact |

---

## Emoji Reference

| Icon | Description | Usage |
|------|-------------|-------|
| 🏢 | Building | Company name |
| 📍 | Location | Address |
| 📞 | Phone | Telephone |
| 📱 | Mobile | Mobile phone |
| ✉️ | Email | Email address |
| 🌐 | Globe | Website |
| 👤 | Person | Contact name |
| 💼 | Briefcase | Job title |
| 🏭 | Factory | Industry |
| 💰 | Money | Revenue |
| 👥 | People | Employees |
| 🎫 | Ticket | Case |
| ⚡ | Lightning | Priority |
| 📊 | Chart | Status |
| 📅 | Calendar | Date |

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `configJson is empty` | No configuration | Add JSON to configJson |
| `Entity ID not available` | Not on form | Place on entity form |
| `Environment variable not found` | Wrong name | Check schema name |
| `Invalid GUID in lookup field` | Wrong field | Use `_fieldname_value` format |
| `sourcefield is required` | Missing config | Add lookupfield or sourcefield |
| `No field names found` | Empty rows | Add fields to rows array |

---

## License

GNU 3.0

## Author

Gmanunta81 
