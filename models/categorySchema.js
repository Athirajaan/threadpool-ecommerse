const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        lowercase: true 
    },
    description: {
        type: String,
        required: true,
    },
    gender: {
        type: String,
        enum: ['Men', 'Women'],  
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
