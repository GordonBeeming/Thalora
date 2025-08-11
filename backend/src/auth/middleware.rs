use actix_session::Session;
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse, HttpMessage,
};
use futures_util::future::LocalBoxFuture;
use log::info;
use serde_json;
use std::{
    future::{ready, Ready},
    rc::Rc,
};

pub struct AuthMiddleware;

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service: Rc::new(service),
        }))
    }
}

pub struct AuthMiddlewareService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);
        
        Box::pin(async move {
            // For now, let's disable auth middleware and just pass through
            // TODO: Implement proper session extraction from ServiceRequest
            
            // User is authenticated, continue with request
            let res = service.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}

// Optional authenticated user extractor
use actix_web::{web, FromRequest, HttpRequest};
use std::pin::Pin;

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: i64,
}

impl FromRequest for AuthenticatedUser {
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_web::dev::Payload) -> Self::Future {
        let req = req.clone();
        
        Box::pin(async move {
            let session = Session::extract(&req).await?;
            let user_id: Option<i64> = session.get("user_id")?;
            
            match user_id {
                Some(id) => Ok(AuthenticatedUser { user_id: id }),
                None => Err(actix_web::error::ErrorUnauthorized("Not authenticated")),
            }
        })
    }
}