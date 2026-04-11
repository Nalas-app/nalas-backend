const orderService = require('./service');

class OrderController {
  async create(req, res, next) {
    try {
      const result = await orderService.createOrder(req.user.id, req.body);

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await orderService.getOrderById(req.params.id);

      res.json({
        success: true,
        message: 'Order retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const { status, from_date, to_date, page = 1, limit = 10 } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;

      const result = await orderService.getAllOrders(filters, page, limit);

      res.json({
        success: true,
        message: 'Orders retrieved successfully',
        data: result,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await orderService.updateOrder(req.params.id, req.body);

      res.json({
        success: true,
        message: 'Order updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const result = await orderService.updateOrderStatus(
        req.params.id,
        req.body.status,
        req.user?.id || null
      );

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async generateQuotation(req, res, next) {
    try {
      const result = await orderService.generateQuotation(
        req.params.id,
        req.user?.id || null
      );

      res.json({
        success: true,
        message: 'Quotation generated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async confirmOrder(req, res, next) {
    try {
      const result = await orderService.confirmOrder(
        req.params.id,
        req.user?.id || null
      );

      res.json({
        success: true,
        message: 'Order confirmed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await orderService.deleteOrder(req.params.id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomerOrders(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const result = await orderService.getCustomerOrders(req.user.id, page, limit);

      res.json({
        success: true,
        message: 'Your orders retrieved successfully',
        data: result,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
