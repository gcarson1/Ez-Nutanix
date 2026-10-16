import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { App } from './ui/shell/App';

render(<App />, document.getElementById('app')!);
