export const getHealth = async (req, res) => {
    try {
        res.status(200).json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};