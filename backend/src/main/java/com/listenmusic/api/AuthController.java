package com.listenmusic.api;

import com.listenmusic.auth.AccountAlreadyActiveException;
import com.listenmusic.auth.AccountAuthService;
import com.listenmusic.auth.AccountView;
import com.listenmusic.auth.NetEaseAuthService;
import com.listenmusic.auth.QqCookieLoginRequest;
import com.listenmusic.auth.QrLoginSessionNotFoundException;
import com.listenmusic.auth.QrLoginStartResponse;
import com.listenmusic.auth.QrLoginStatusResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final NetEaseAuthService authService;
    private final AccountAuthService accountAuthService;

    public AuthController(NetEaseAuthService authService, AccountAuthService accountAuthService) {
        this.authService = authService;
        this.accountAuthService = accountAuthService;
    }

    @GetMapping("/{provider}/qr/start")
    public QrLoginStartResponse startQr(@PathVariable String provider) {
        return authService.startQrLogin(provider);
    }

    @GetMapping("/{provider}/qr/status")
    public QrLoginStatusResponse qrStatus(
        @PathVariable String provider,
        @RequestParam String sessionId
    ) {
        if (!"netease".equalsIgnoreCase(provider)) {
            throw new IllegalArgumentException("暂不支持的平台: " + provider);
        }
        return authService.checkQrLogin(sessionId);
    }

    @GetMapping("/current")
    public ResponseEntity<?> current() {
        return authService.currentAccount()
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NO_CONTENT).build());
    }

    @GetMapping("/accounts")
    public List<AccountView> accounts() {
        return accountAuthService.accounts();
    }

    @PostMapping("/qq/cookie")
    public AccountView loginQq(@org.springframework.web.bind.annotation.RequestBody QqCookieLoginRequest request) {
        return accountAuthService.loginQq(request.cookie());
    }

    @GetMapping("/{provider}/account")
    public ResponseEntity<AccountView> account(@PathVariable String provider) {
        return authService.account(provider)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{provider}/logout")
    public Map<String, Object> logout(@PathVariable String provider) {
        accountAuthService.logout(provider);
        return Map.of("ok", true);
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(AccountAlreadyActiveException.class)
    public ResponseEntity<Map<String, String>> accountAlreadyActive(AccountAlreadyActiveException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("code", "ACCOUNT_ALREADY_ACTIVE", "message", ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(QrLoginSessionNotFoundException.class)
    public ResponseEntity<Map<String, String>> sessionNotFound(QrLoginSessionNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("code", "QR_SESSION_NOT_FOUND", "message", ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalidCredential(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("code", "INVALID_CREDENTIAL", "message", ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> providerUnavailable(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(Map.of("code", "PROVIDER_UNAVAILABLE", "message", ex.getMessage()));
    }
}
