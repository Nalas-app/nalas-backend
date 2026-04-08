# 🚀 QUICK IMPLEMENTATION TEMPLATE

Copy this template for each new module to maintain consistency.

---

## **STEP 1: Create Module Folder**

```bash
mkdir src/modules/[module-name]
cd src/modules/[module-name]
```

Create these 5 files in order:

---

## **STEP 2: validators.js** (Data contracts)

```javascript
const Joi = require('joi');

// Define what data we accept
const create[Module]Schema = Joi.object({
  field1: Joi.string().required(),
  field2: Joi.number().min(0).required(),
  field3: Joi.date(),
  field4: Joi.array().items(Joi.string()),
  field5: Joi.boolean().default(true)
});

const update[Module]Schema = Joi.object({
  field1: Joi.string(),
  field2: Joi.number().min(0)
  // Make fields optional for updates
});

const querySchema = Joi.object({
  page: Joi.number().default(1),
  limit: Joi.number().default(10),
  sortBy: Joi.string().default('created_at')
});

module.exports = {
  create[Module]Schema,
  update[Module]Schema,
  querySchema
};
```

---

## **STEP 3: repository.js** (Database layer)

```javascript
const db = require('../../config/database');

class [Module]Repository {
  // CREATE
  async create(data) {
    const query = `
      INSERT INTO [table_name] 
      (field1, field2, field3, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await db.query(query, [data.field1, data.field2, data.field3]);
    return result.rows[0];
  }

  // READ ONE
  async findById(id) {
    const query = 'SELECT * FROM [table_name] WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  // READ MANY
  async findAll(filters = {}) {
    let query = 'SELECT * FROM [table_name] WHERE 1=1';
    const params = [];

    if (filters.field1) {
      query += ` AND field1 = $${params.length + 1}`;
      params.push(filters.field1);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    
    const result = await db.query(query, params);
    return result.rows;
  }

  // UPDATE
  async update(id, data) {
    const query = `
      UPDATE [table_name]
      SET field1 = $1, field2 = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(query, [data.field1, data.field2, id]);
    return result.rows[0];
  }

  // DELETE
  async delete(id) {
    const query = 'DELETE FROM [table_name] WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = new [Module]Repository();
```

---

## **STEP 4: service.js** (Business logic)

```javascript
const AppError = require('../../shared/errors/AppError');
const [module]Repository = require('./repository');

class [Module]Service {
  // CREATE with validation
  async create(data) {
    // Check business rules BEFORE saving
    const existing = await [module]Repository.findById(data.relatedId);
    if (!existing) {
      throw AppError.notFound('Related record');
    }

    // Save to database
    const result = await [module]Repository.create(data);
    
    // Return formatted response
    return {
      id: result.id,
      field1: result.field1,
      field2: result.field2,
      createdAt: result.created_at
    };
  }

  // GET ONE
  async getById(id) {
    const result = await [module]Repository.findById(id);
    if (!result) {
      throw AppError.notFound('[Module]');
    }
    return result;
  }

  // GET MANY
  async getAll(filters) {
    return await [module]Repository.findAll(filters);
  }

  // UPDATE with validation
  async update(id, data) {
    const existing = await [module]Repository.findById(id);
    if (!existing) {
      throw AppError.notFound('[Module]');
    }

    // Check business rules for update
    if (data.status && !isValidStatus(data.status)) {
      throw AppError.badRequest('Invalid status', { status: data.status });
    }

    return await [module]Repository.update(id, data);
  }

  // DELETE
  async delete(id) {
    const existing = await [module]Repository.findById(id);
    if (!existing) {
      throw AppError.notFound('[Module]');
    }

    // Check if can be deleted
    if (existing.status === 'locked') {
      throw AppError.badRequest('Cannot delete locked record');
    }

    return await [module]Repository.delete(id);
  }
}

module.exports = new [Module]Service();
```

---

## **STEP 5: controller.js** (Request handlers)

```javascript
const [module]Service = require('./service');

class [Module]Controller {
  // CREATE
  async create(req, res, next) {
    try {
      const result = await [module]Service.create(req.body);
      res.status(201).json({
        success: true,
        message: '[Module] created successfully',
        data: result
      });
    } catch (error) {
      next(error); // Pass to error middleware
    }
  }

  // GET LIST
  async getList(req, res, next) {
    try {
      const results = await [module]Service.getAll(req.query);
      res.json({
        success: true,
        message: '[Modules] retrieved successfully',
        data: results,
        count: results.length
      });
    } catch (error) {
      next(error);
    }
  }

  // GET ONE
  async getById(req, res, next) {
    try {
      const result = await [module]Service.getById(req.params.id);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // UPDATE
  async update(req, res, next) {
    try {
      const result = await [module]Service.update(req.params.id, req.body);
      res.json({
        success: true,
        message: '[Module] updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE
  async delete(req, res, next) {
    try {
      await [module]Service.delete(req.params.id);
      res.json({
        success: true,
        message: '[Module] deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new [Module]Controller();
```

---

## **STEP 6: routes.js** (Wire it up)

```javascript
const express = require('express');
const [module]Controller = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const {
  create[Module]Schema,
  update[Module]Schema,
  querySchema
} = require('./validators');

const router = express.Router();

// GET /api/v1/[modules]
router.get('/',
  authenticate,
  validate(querySchema, 'query'),
  [module]Controller.getList
);

// GET /api/v1/[modules]/:id
router.get('/:id',
  authenticate,
  [module]Controller.getById
);

// POST /api/v1/[modules]
router.post('/',
  authenticate,
  validate(create[Module]Schema),
  [module]Controller.create
);

// PUT /api/v1/[modules]/:id
router.put('/:id',
  authenticate,
  validate(update[Module]Schema),
  [module]Controller.update
);

// DELETE /api/v1/[modules]/:id
router.delete('/:id',
  authenticate,
  requireRole('admin', 'super_admin'),  // Only admins can delete
  [module]Controller.delete
);

module.exports = router;
```

---

## **STEP 7: Register in app.js**

Add this line to `src/app.js` after auth routes:

```javascript
// API Routes
app.use('/api/v1/auth', require('./modules/auth/routes'));
app.use('/api/v1/[modules]', require('./modules/[module]/routes'));
```

---

## **STEP 8: Test Endpoints**

```bash
# Test your endpoints with curl or Postman

# GET list
curl -X GET http://localhost:3000/api/v1/[modules] \
  -H "Authorization: Bearer YOUR_TOKEN"

# CREATE
curl -X POST http://localhost:3000/api/v1/[modules] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"field1": "value1", "field2": 100}'

# UPDATE
curl -X PUT http://localhost:3000/api/v1/[modules]/ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"field1": "new value"}'

# DELETE
curl -X DELETE http://localhost:3000/api/v1/[modules]/ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## **STEP 9: Write Tests** (Optional but recommended)

Create `tests/unit/[module].test.js`:

```javascript
const [module]Service = require('../../src/modules/[module]/service');
const AppError = require('../../src/shared/errors/AppError');

describe('[Module] Service', () => {
  test('should create [module] with valid data', async () => {
    const data = { field1: 'test', field2: 100 };
    const result = await [module]Service.create(data);
    expect(result.id).toBeDefined();
    expect(result.field1).toBe('test');
  });

  test('should throw error if required field missing', async () => {
    const data = { field1: 'test' }; // missing field2
    expect([module]Service.create(data)).rejects.toThrow(AppError);
  });

  test('should get [module] by ID', async () => {
    const result = await [module]Service.getById('some-id');
    expect(result).toBeDefined();
  });
});
```

Run: `npm test`

---

## **STEP 10: COMMIT!** 🎉

```bash
git add src/modules/[module]/
git commit -m "feat([module]): implement CRUD operations"
git push origin master
```

---

## **CHECKLIST AFTER EACH MODULE**

- [ ] All 5 files created (validators, repository, service, controller, routes)
- [ ] Routes registered in app.js
- [ ] Database table exists (in schema)
- [ ] Validation schemas defined
- [ ] Error handling using AppError
- [ ] Tests written
- [ ] Endpoints tested with Postman/curl
- [ ] Committed and pushed
- [ ] README updated
- [ ] API documentation created in `/docs/api/`

