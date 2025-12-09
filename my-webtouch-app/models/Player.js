import mongoose from 'mongoose';

const PlayerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    score: {
        type: Number,
        required: true,
        default: 0
    }
}, { timestamps: true });

// Prevent recompilation of model if it already exists
const Player = mongoose.models.Player || mongoose.model('Player', PlayerSchema);

export default Player;