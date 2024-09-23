import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const [ seconds, setSeconds ] = React.useState(3);
    const navigate = useNavigate();
    let interval

    useEffect(() => {
        if (interval) {
            return;
        }

        interval = setInterval(() => {
            setSeconds(seconds => {
                if (seconds === 0) {
                    clearInterval(interval);
                    navigate('/');
                }

                return seconds - 1
            });

        }, 1000);
    }, []);

    return (
        <div className='posts'>
            <h1>404 - Page Not Found</h1>
            <p>The page you are looking for does not exist.</p>
            <p>You will be redirected to the homepage in {seconds} seconds.</p>
        </div>
    );
};

export default NotFound;
